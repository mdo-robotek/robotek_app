import { NextRequest, NextResponse } from "next/server";
import { o2dService } from "@/lib/o2d-sheets";
import { uploadFileToDrive, O2D_UPLOADS_FOLDER_ID } from "@/lib/google-drive";
import { sendO2DRemarkNotification } from "@/lib/o2d-notifications";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const { orderNo } = await params;
    const contentType = req.headers.get("content-type") || "";
    
    let updatedItems: any[] = [];
    let screenshotUrl = "";
    let isEditingDetails = false;

    if (contentType.includes("multipart/form-data")) {
      isEditingDetails = true;
      const formData = await req.formData();
      updatedItems = JSON.parse(formData.get("o2dData") as string) as any[];
      const screenshotFile = formData.get("order_screenshot") as File;

      if (screenshotFile && screenshotFile.size > 0) {
        const fileId = await uploadFileToDrive(screenshotFile, O2D_UPLOADS_FOLDER_ID);
        screenshotUrl = fileId || "";
      } else {
        screenshotUrl = updatedItems[0]?.order_screenshot || "";
      }
    } else {
      updatedItems = await req.json();
      screenshotUrl = updatedItems[0]?.order_screenshot || "";
    }

    if (!updatedItems || updatedItems.length === 0) {
      return NextResponse.json({ error: "Cannot update order with empty items array. Use DELETE endpoint instead." }, { status: 400 });
    }

    // Server-side safeguard: if multiple items are sent for one order, merge them
    if (updatedItems.length > 1 && updatedItems.every(it => !it.item_name?.includes(" | "))) {
      const first = updatedItems[0];
      const idToUse = first.id?.toString().split("-")[0];
      
      const mergedItem = {
        ...first,
        id: idToUse,
        item_name: updatedItems.map((it, i) => `${i + 1}. ${it.item_name}`).join(" | "),
        item_qty: updatedItems.map((it, i) => `${i + 1}. ${it.item_qty}`).join(" | "),
        est_amount: updatedItems.map((it, i) => `${i + 1}. ${it.est_amount}`).join(" | "),
        item_specification: updatedItems.map((it, i) => `${i + 1}. ${it.item_specification || ""}`).join(" | "),
      };
      updatedItems = [mergedItem];
    }

    const allRecords = await o2dService.getAll();
    const existingForOrder = allRecords.filter(r => r.order_no === orderNo);
    const existingIds = new Set(existingForOrder.map(r => r.id));
    const incomingIds = new Set(updatedItems.map(r => r.id).filter(id => !!id));

    await Promise.all(updatedItems.map(async (item) => {
      const itemData = {
        ...item,
        order_screenshot: screenshotUrl,
        updated_at: new Date().toISOString()
      };

      if (item.id && existingIds.has(item.id)) {
        return o2dService.update(item.id, itemData);
      } else {
        return o2dService.add({
          ...itemData,
          id: item.id || `O2D-${Date.now()}-${Math.random()}`
        });
      }
    }));

    const idsToDelete = [...existingIds].filter(id => !incomingIds.has(id));
    await Promise.all(idsToDelete.map(id => o2dService.delete(id)));

    // ONLY send WhatsApp Notification for core order detail edits
    // Step updates (which use application/json) will NOT trigger notifications
    if (isEditingDetails) {
      await sendO2DRemarkNotification(updatedItems, "Updated");
    }

    return NextResponse.json({ message: "Order updated successfully", items: updatedItems });
  } catch (error: any) {
    console.error("PUT Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const { orderNo } = await params;
    const allRecords = await o2dService.getAll();
    const matching = allRecords.filter(r => r.order_no === orderNo);

    await Promise.all(matching.map(item => o2dService.delete(item.id)));

    // Send WhatsApp Notification for the deleted order
    if (matching.length > 0) {
      await sendO2DRemarkNotification(matching, "Deleted");
    }

    return NextResponse.json({ message: "Order deleted successfully" });
  } catch (error: any) {
    console.error("DELETE Order Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
