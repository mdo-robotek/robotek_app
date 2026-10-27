import { NextResponse } from "next/server";
import { getServiceForModule, addHrmsItem, updateHrmsItem, deleteHrmsItem, createOnboardFromCandidate } from "@/lib/hrms-sheets";
import { Candidate, HrmsModuleType } from "@/types/hrms";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module: rawModule } = await params;
  const module = rawModule as HrmsModuleType;
  if (!["recruitment", "candidate", "sales", "onboard", "offboard"].includes(module)) {
    return NextResponse.json({ error: "Invalid module" }, { status: 400 });
  }

  try {
    const service = getServiceForModule(module);
    const items = await service.getAll();
    return NextResponse.json(items);
  } catch (error) {
    console.error(`Failed to fetch ${module}:`, error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module: rawModule } = await params;
  const module = rawModule as HrmsModuleType;
  try {
    const body = await request.json();
    const success = await addHrmsItem(module, body);
    if (success) {
      const service = getServiceForModule(module);
      const items = await service.getAll();
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  } catch (error) {
    console.error(`Error in POST ${module}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module: rawModule } = await params;
  const module = rawModule as HrmsModuleType;
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }
    const success = await updateHrmsItem(module, body.id, body);
    if (success) {
      // Step 7 decided "Selected" → start Onboarding automatically (only once).
      if (module === "candidate" && body.actual_7 && String(body.status_7 || "").trim().toLowerCase() === "selected") {
        const onboard = await createOnboardFromCandidate(body as Candidate);
        return NextResponse.json({ success: true, onboard });
      }
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  } catch (error) {
    console.error(`Error in PUT ${module}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const { module: rawModule } = await params;
  const module = rawModule as HrmsModuleType;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }
    const success = await deleteHrmsItem(module, id);
    if (success) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  } catch (error) {
    console.error(`Error in DELETE ${module}:`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
