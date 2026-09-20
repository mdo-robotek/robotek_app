import { google, sheets_v4 } from "googleapis";

let sheetsClient: sheets_v4.Sheets | null = null;

export async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUrl = process.env.NEXTAUTH_URL;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUrl);
    const tokensStr = process.env.GOOGLE_OAUTH_TOKENS;
    
    if (!tokensStr) throw new Error("GOOGLE_OAUTH_TOKENS environment variable is not set");
    
    oauth2Client.setCredentials(JSON.parse(tokensStr));
    sheetsClient = google.sheets({ version: "v4", auth: oauth2Client });
    return sheetsClient;
  } catch (error: any) {
    console.error("[Sheets Lib] Failed to initialize sheets client:", error.message);
    throw error;
  }
}

export async function deleteSheetRow(spreadsheetId: string, sheetName: string, itemId: string) {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:Z`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === itemId);

    if (rowIndex === -1) return { success: false, error: "Item not found" };

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${sheetName}'!A${rowIndex + 1}:Z${rowIndex + 1}`,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

export async function updateSheetRow(spreadsheetId: string, sheetName: string, itemId: string, rowData: any[]) {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:Z`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === itemId);

    if (rowIndex === -1) return { success: false, error: "Item not found" };

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [rowData] },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}
