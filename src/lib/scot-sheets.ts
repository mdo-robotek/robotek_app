import { getSheetsClient } from "./sheet-utils";

const SCOT_SPREADSHEET_ID = "1DUWUB_vySOgV3gWg_Vsz-jt4Ws_B4SBSj1pIfhqEfh0";
const SCOT_SHEET_NAME = "Data Feeder";

export interface ScotRecord {
  id: string;
  employeeName: string;
  employeeNumber: string;
  toName: string;
  countryCode: string;
  toNumber: string;
  callType: string;
  duration: string;
  callDate: string;
  callTime: string;
  timestamp: string;
  updated_at: string;
}

export interface CallRecord {
  partyName: string;
  concernPerson: string;
  mobileNum: string;
  firmName: string;
  district: string;
  state: string;
  region: string;
  creditDaysNew: string;
  limit: string;
  collectionRating: string;
  customerType: string;
  salesPerson: string;
  salesCoordinator: string;
  averageOrderSize: string;
  targetAvgOrderSize: string;
  usuallyNoOfOrderMonthly: string;
  frequencyOfCallingAfterOrderPlaced: string;
  specialRemarkJSON: string;
}

export interface FollowUpRecord {
  partyName: string;
  status: string;
  nextFollowUpDate: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
  lastFollowUpDate: string;
}

export async function getScotData(): Promise<ScotRecord[]> {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SCOT_SPREADSHEET_ID,
      range: `'${SCOT_SHEET_NAME}'!A2:L`,
    });

    const rows = response.data.values || [];
    return rows.map((row) => ({
      id: row[0] || "",
      employeeName: row[1] || "",
      employeeNumber: row[2] || "",
      toName: row[3] || "",
      countryCode: row[4] || "",
      toNumber: row[5] || "",
      callType: row[6] || "",
      duration: row[7] || "",
      callDate: row[8] || "",
      callTime: row[9] || "",
      timestamp: row[10] || "",
      updated_at: row[11] || "",
    }));
  } catch (error) {
    console.error("Error fetching Scot data:", error);
    return [];
  }
}

export async function getCallData(): Promise<CallRecord[]> {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SCOT_SPREADSHEET_ID,
      range: `'Calls'!A2:R`,
    });

    const rows = response.data.values || [];
    return rows.map((row) => ({
      partyName: row[0] || "",
      concernPerson: row[1] || "",
      mobileNum: row[2] || "",
      firmName: row[3] || "",
      district: row[4] || "",
      state: row[5] || "",
      region: row[6] || "",
      creditDaysNew: row[7] || "",
      limit: row[8] || "",
      collectionRating: row[9] || "",
      customerType: row[10] || "",
      salesPerson: row[11] || "",
      salesCoordinator: row[12] || "",
      averageOrderSize: row[13] || "",
      targetAvgOrderSize: row[14] || "",
      usuallyNoOfOrderMonthly: row[15] || "",
      frequencyOfCallingAfterOrderPlaced: row[16] || "",
      specialRemarkJSON: row[17] || "[]",
    }));
  } catch (error) {
    console.error("Error fetching Call data:", error);
    return [];
  }
}

export async function updateCallData(partyName: string, data: Partial<CallRecord>): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    
    // Fetch all rows to find the matching party name
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SCOT_SPREADSHEET_ID,
      range: `'Calls'!A:R`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === partyName);

    if (rowIndex === -1) {
      console.error(`Party ${partyName} not found in Calls sheet`);
      return false;
    }

    // Prepare updated row
    const currentRow = rows[rowIndex];
    const updatedRow = [...currentRow];
    
    // Map keys back to indices (0-16)
    const keys: (keyof CallRecord)[] = [
      'partyName', 'concernPerson', 'mobileNum', 'firmName', 'district', 'state', 'region',
      'creditDaysNew', 'limit', 'collectionRating', 'customerType', 'salesPerson', 'salesCoordinator',
      'averageOrderSize', 'targetAvgOrderSize', 'usuallyNoOfOrderMonthly', 'frequencyOfCallingAfterOrderPlaced',
      'specialRemarkJSON'
    ];

    keys.forEach((key, index) => {
      if (data[key] !== undefined) {
        updatedRow[index] = data[key];
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SCOT_SPREADSHEET_ID,
      range: `'Calls'!A${rowIndex + 1}:R${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [updatedRow],
      },
    });

    return true;
  } catch (error) {
    console.error("Error updating Call data:", error);
    return false;
  }
}

export async function addCallRecord(data: CallRecord): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    
    const row = [
      data.partyName,
      data.concernPerson,
      data.mobileNum,
      data.firmName,
      data.district,
      data.state,
      data.region,
      data.creditDaysNew,
      data.limit,
      data.collectionRating,
      data.customerType,
      data.salesPerson,
      data.salesCoordinator,
      data.averageOrderSize,
      data.targetAvgOrderSize,
      data.usuallyNoOfOrderMonthly,
      data.frequencyOfCallingAfterOrderPlaced,
      data.specialRemarkJSON || "[]"
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SCOT_SPREADSHEET_ID,
      range: `'Calls'!A:R`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row],
      },
    });

    return true;
  } catch (error) {
    console.error("Error adding Call record:", error);
    return false;
  }
}

export async function appendScotData(records: any[][]): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SCOT_SPREADSHEET_ID,
      range: `'${SCOT_SHEET_NAME}'!A:L`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: records,
      },
    });
    return true;
  } catch (error) {
    console.error("Error appending Scot data:", error);
    return false;
  }
}

export async function saveFollowUpData(record: FollowUpRecord, source: "scot" | "scot-kb" = "scot"): Promise<boolean> {
  const spreadsheetId = source === "scot" ? SCOT_SPREADSHEET_ID : SCOT_KB_SPREADSHEET_ID;
  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'Follow Up'!A:G`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          record.partyName,
          record.status,
          record.nextFollowUpDate,
          record.remarks,
          record.createdBy,
          record.createdAt,
          record.lastFollowUpDate
        ]],
      },
    });
    return true;
  } catch (error: any) {
    if (error.message?.includes('Unable to parse range')) {
        const sheets = await getSheetsClient();
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "Follow Up" } } }]
          }
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'Follow Up'!A1:G1`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [["Party Name", "Status", "Next Follow Up Date", "Remarks", "Created By", "CreatedAt", "Last Follow Up Date"]]
          }
        });
        return await saveFollowUpData(record, source);
    }
    console.error("Error saving Follow Up data:", error);
    return false;
  }
}

export async function getFollowUpData(source: "scot" | "scot-kb" = "scot"): Promise<FollowUpRecord[]> {
  const spreadsheetId = source === "scot" ? SCOT_SPREADSHEET_ID : SCOT_KB_SPREADSHEET_ID;
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'Follow Up'!A2:G`,
    });

    const rows = response.data.values || [];
    return rows.map((row) => ({
      partyName: row[0] || "",
      status: row[1] || "",
      nextFollowUpDate: row[2] || "",
      remarks: row[3] || "",
      createdBy: row[4] || "",
      createdAt: row[5] || "",
      lastFollowUpDate: row[6] || "",
    }));
  } catch (error: any) {
    if (error.message?.includes('Unable to parse range')) {
        const sheets = await getSheetsClient();
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "Follow Up" } } }]
          }
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'Follow Up'!A1:G1`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [["Party Name", "Status", "Next Follow Up Date", "Remarks", "Created By", "CreatedAt", "Last Follow Up Date"]]
          }
        });
        return [];
    }
    console.error("Error fetching Follow Up data:", error);
    return [];
  }
}

export interface FrequencyRecord {
  partyName: string;
  frequency: string;
}

const SCOT_KB_SPREADSHEET_ID = "1IhvpIYKBojl3hn0SdV-gMp79ehNg5p4Ggp_Znjfzc-I";

export async function getFrequencyData(source: "scot" | "scot-kb" = "scot-kb"): Promise<FrequencyRecord[]> {
  const spreadsheetId = source === "scot" ? SCOT_SPREADSHEET_ID : SCOT_KB_SPREADSHEET_ID;
  try {
    const sheets = await getSheetsClient();
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'Frequency'!A:B`,
      });
    } catch (err: any) {
      if (err.message?.includes('Unable to parse range')) {
        // Sheet doesn't exist, try to create it
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "Frequency" } } }]
          }
        });
        // Add headers
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Frequency'!A:B`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [["Party Name", "Frequency (Days)"]] }
        });
        // Try getting again (it will be empty but won't error)
        response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'Frequency'!A:B`,
        });
      } else {
        throw err;
      }
    }

    const rows = response.data.values || [];
    return rows.map((row) => ({
      partyName: row[0] || "",
      frequency: row[1] || "",
    }));
  } catch (error) {
    console.error("Error fetching Frequency data:", error);
    return [];
  }
}

export async function updateFrequencyData(partyName: string, frequency: string, source: "scot" | "scot-kb" = "scot-kb"): Promise<boolean> {
  const spreadsheetId = source === "scot" ? SCOT_SPREADSHEET_ID : SCOT_KB_SPREADSHEET_ID;
  try {
    const sheets = await getSheetsClient();
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'Frequency'!A:B`,
      });
    } catch (err: any) {
      if (err.message?.includes('Unable to parse range')) {
        // Sheet doesn't exist, try to create it
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "Frequency" } } }]
          }
        });
        // Add headers
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'Frequency'!A:B`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [["Party Name", "Frequency (Days)"]] }
        });
        // Try getting again
        response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'Frequency'!A:B`,
        });
      } else {
        throw err;
      }
    }

    const rows = response.data.values || [];
    // Start index at 0, row numbers start at 1
    const rowIndex = rows.findIndex(row => (row[0] || "").toLowerCase().trim() === partyName.toLowerCase().trim());

    if (rowIndex !== -1) {
      // Update existing
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Frequency'!A${rowIndex + 1}:B${rowIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[rows[rowIndex][0], frequency]],
        },
      });
    } else {
      // Append new
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'Frequency'!A1:B`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[partyName, frequency]],
        },
      });
    }

    return true;
  } catch (error: any) {
    console.error("Error updating Frequency data:", error);
    throw new Error(error.message || "Failed to update frequency data in sheet");
  }
}

export interface ActivePartyRecord {
  partyName: string;
  active: boolean;
}

async function ensureActivePartySheet(spreadsheetId: string) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: "Active Party" } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'Active Party'!A1:B1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["Party Name", "Active"]],
    },
  });
}

export async function getActivePartyData(source: "scot" | "scot-kb" = "scot"): Promise<ActivePartyRecord[]> {
  const spreadsheetId = source === "scot" ? SCOT_SPREADSHEET_ID : SCOT_KB_SPREADSHEET_ID;
  try {
    const sheets = await getSheetsClient();
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'Active Party'!A2:B`,
      });
    } catch (err: any) {
      if (err.message?.includes("Unable to parse range")) {
        await ensureActivePartySheet(spreadsheetId);
        return [];
      }
      throw err;
    }

    const rows = response.data.values || [];
    return rows
      .map((row) => ({
        partyName: row[0] || "",
        active: String(row[1] || "").toUpperCase() === "TRUE",
      }))
      .filter((row) => row.partyName);
  } catch (error) {
    console.error("Error fetching Active Party data:", error);
    return [];
  }
}

export async function updateActivePartyData(
  partyName: string,
  active: boolean,
  source: "scot" | "scot-kb" = "scot"
): Promise<boolean> {
  const spreadsheetId = source === "scot" ? SCOT_SPREADSHEET_ID : SCOT_KB_SPREADSHEET_ID;
  try {
    const sheets = await getSheetsClient();
    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'Active Party'!A:B`,
      });
    } catch (err: any) {
      if (err.message?.includes("Unable to parse range")) {
        await ensureActivePartySheet(spreadsheetId);
        response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `'Active Party'!A:B`,
        });
      } else {
        throw err;
      }
    }

    const rows = response.data.values || [];
    const normalized = partyName.toLowerCase().trim();
    const rowIndex = rows.findIndex(
      (row, idx) => idx > 0 && (row[0] || "").toLowerCase().trim() === normalized
    );

    if (rowIndex !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Active Party'!A${rowIndex + 1}:B${rowIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[rows[rowIndex][0] || partyName, active ? "TRUE" : "FALSE"]],
        },
      });
    } else {
      // Persist the record whether marking active OR inactive, so a
      // never-touched party can be explicitly excluded (default = active).
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'Active Party'!A:B`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[partyName, active ? "TRUE" : "FALSE"]],
        },
      });
    }

    return true;
  } catch (error: any) {
    console.error("Error updating Active Party data:", error);
    throw new Error(error.message || "Failed to update active party in sheet");
  }
}
