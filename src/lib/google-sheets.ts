import { google } from "googleapis";
import { User } from "@/types/user";
import { globalCache } from "./cache";
import { getUsersCacheKey, getUsersCacheTtl, invalidateUsersCache } from "./sheet-cache-keys";

export { invalidateUsersCache };

const GOOGLE_SHEET_ID = "1cuOGO1UZ3O41zUDrowRlFZ6FCSfUWVsmfVULA0Jx6Tg";
const SHEET_NAME = "user";

async function getSheetsClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL // Or your redirect URI
  );

  const tokens = JSON.parse(process.env.GOOGLE_OAUTH_TOKENS || "{}");
  oauth2Client.setCredentials(tokens);

  // Handle token refresh if necessary
  oauth2Client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) {
      // In a real app, you'd save this back to your DB or .env
      console.log('New refresh token received');
    }
    console.log('New access token received');
  });

  return google.sheets({ version: "v4", auth: oauth2Client });
}

export async function getUsers(): Promise<User[]> {
  const cacheKey = getUsersCacheKey();
  const cached = globalCache.get<User[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:Q`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return [];

    const users = rows.slice(1).map((row) => {
      const id = row[0] || "";
      let permissions: string[] = [];
      try {
        if (row[15]) {
          permissions = JSON.parse(row[15]);
        }
      } catch (e) {
        console.error("Error parsing permissions for user", id, e);
      }

      return {
        id,
        username: row[1] || "",
        email: row[2] || "",
        password: row[3] || "",
        phone: row[4] || "",
        role_name: row[5] || "",
        late_long: row[6] || "",
        image_url: row[7] || "",
        dob: row[8] || "",
        anniversary_date: row[12] || "",
        doj: row[13] || "",
        office: row[9] || "",
        designation: row[10] || "",
        department: row[11] || "",
        last_active: "", // Placeholder or remove if not needed
        isActive: row[14] === "TRUE" || row[14] === true || row[14] === undefined || row[14] === "", // Now O column (index 14)
        // Q column (index 16): "Track Attendance". Defaults to true (tracked) unless explicitly "No" —
        // so existing/new rows that never set this keep showing up in attendance widgets as before.
        trackAttendance: String(row[16] ?? "").trim().toLowerCase() !== "no",
        permissions: permissions,
      };
    });

    globalCache.set(cacheKey, users, getUsersCacheTtl());
    return users;
  } catch (error) {
    console.error("Error fetching users from Google Sheets:", error);
    return [];
  }
}

export async function addUser(user: User): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:Q`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          user.id,
          user.username,
          user.email,
          user.password,
          user.phone,
          user.role_name,
          user.late_long,
          user.image_url,
          user.dob,
          user.office || "",
          user.designation || "",
          user.department || "",
          user.anniversary_date || "",
          user.doj || "",
          user.isActive !== false ? "TRUE" : "FALSE", // Index 14 (O)
          JSON.stringify(user.permissions || []), // Index 15 (P)
          user.trackAttendance === false ? "No" : "Yes" // Index 16 (Q)
        ]],
      },
    });
    invalidateUsersCache();
    return true;
  } catch (error) {
    console.error("Error adding user to Google Sheets:", error);
    return false;
  }
}

export async function updateUser(id: string, user: User): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = response.data.values;
    if (!rows) return false;

    const rowIndex = rows.findIndex(row => row[0] === id);
    if (rowIndex === -1) return false;

    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A${rowIndex + 1}:Q${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          user.id,
          user.username,
          user.email,
          user.password,
          user.phone,
          user.role_name,
          user.late_long,
          user.image_url,
          user.dob,
          user.office || "",
          user.designation || "",
          user.department || "",
          user.anniversary_date || "",
          user.doj || "",
          user.isActive !== false ? "TRUE" : "FALSE", // Index 14 (O)
          JSON.stringify(user.permissions || []), // Index 15 (P)
          user.trackAttendance === false ? "No" : "Yes" // Index 16 (Q)
        ]],
      },
    });
    invalidateUsersCache();
    return true;
  } catch (error) {
    console.error("Error updating user in Google Sheets:", error);
    return false;
  }
}

const VISIBILITY_SHEET_NAME = "page_visibility";

export async function getPagePermissions(): Promise<Record<string, string[]>> {
  const cacheKey = "page_permissions";
  const cached = globalCache.get<Record<string, string[]>>(cacheKey);
  if (cached) {
    console.log("[CACHE HIT] Permissions");
    return cached;
  }

  try {
    console.log("[API CALL] Fetching Permissions from User sheet...");
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:P`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return {};

    const permissions: Record<string, string[]> = {};

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const userId = row[0];
        let userPerms: string[] = [];
        
        try {
          if (row[15]) {
            userPerms = JSON.parse(row[15]);
          }
        } catch (e) {
          console.error("Error parsing permissions for user", userId, e);
        }
        
        permissions[userId] = userPerms;
    }

    globalCache.set(cacheKey, permissions, 15 * 60 * 1000); // 15 minutes TTL
    return permissions;
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return {};
  }
}

export async function updateUserPermissions(userId: string, username: string, userPermissions: string[], allPageIds: string[]): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    
    // 1. Get current data from user sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:P`,
    });

    let rows = response.data.values || [];
    if (rows.length === 0) return false;

    // 2. Find user row
    const rowIndex = rows.findIndex(row => row[0] === userId);
    if (rowIndex === -1) return false;
    
    // 3. Update the permissions column (P is index 15)
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!P${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[JSON.stringify(userPermissions)]] },
    });

    globalCache.delete("page_permissions");
    return true;
  } catch (error) {
    console.error("Error updating user permissions:", error);
    return false;
  }
}

function getColumnLetter(column: number): string {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

export async function deleteUser(id: string): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    
    // Find row in user sheet
    const userResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const userRows = userResponse.data.values;
    if (!userRows) return false;

    const userRowIndex = userRows.findIndex(row => row[0] === id);
    if (userRowIndex === -1) return false;

    // Get spreadsheet info to get sheet IDs
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEET_ID
    });
    
    const userSheetId = spreadsheet.data.sheets?.find(s => s.properties?.title === SHEET_NAME)?.properties?.sheetId;
    const visibilitySheetId = spreadsheet.data.sheets?.find(s => s.properties?.title === VISIBILITY_SHEET_NAME)?.properties?.sheetId;

    if (userSheetId === undefined) {
      console.error(`Sheet with name ${SHEET_NAME} not found.`);
      return false;
    }

    const requests: any[] = [
      {
        deleteDimension: {
          range: {
            sheetId: userSheetId,
            dimension: "ROWS",
            startIndex: userRowIndex,
            endIndex: userRowIndex + 1
          }
        }
      }
    ];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: {
        requests
      }
    });
    
    return true;
  } catch (error) {
    console.error("Error deleting user from Google Sheets:", error);
    return false;
  }
}

export async function getUserByUsernameOrEmail(identifier: string): Promise<User | null> {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:P`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return null;

    const dataRows = rows.slice(1);
    
    const userRow = dataRows.find(row => 
      row[1] === identifier || row[2] === identifier
    );

    if (!userRow) return null;

    const user: User = {
      id: userRow[0],
      username: userRow[1],
      email: userRow[2],
      password: userRow[3],
      phone: userRow[4],
      role_name: userRow[5],
      late_long: userRow[6],
      image_url: userRow[7],
      dob: userRow[8],
      office: userRow[9],
      designation: userRow[10],
      department: userRow[11],
      anniversary_date: userRow[12],
      doj: userRow[13],
      last_active: "",
      isActive: userRow[14] === "TRUE" || userRow[14] === true || userRow[14] === undefined || userRow[14] === "",
      permissions: (() => {
        try {
          return userRow[15] ? JSON.parse(userRow[15]) : [];
        } catch (e) {
          return [];
        }
      })()
    } as any;


    return user;
  } catch (error) {
    console.error("Error fetching user from Google Sheets:", error);
    return null;
  }
}

const DROPDOWN_SHEET_NAME = "Dropdown";

export async function getDropdownData(): Promise<{ departments: string[], designations: string[] }> {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${DROPDOWN_SHEET_NAME}!A1:Z`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return { departments: [], designations: [] };

    const headers = (rows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    const deptIndex = headers.indexOf("department");
    const desigIndex = headers.indexOf("designation");

    const dataRows = rows.slice(1);
    const departments = deptIndex !== -1 ? dataRows.map(row => row[deptIndex]).filter(Boolean) : [];
    const designations = desigIndex !== -1 ? dataRows.map(row => row[desigIndex]).filter(Boolean) : [];

    return { departments, designations };
  } catch (error) {
    console.error("Error fetching dropdown data:", error);
    return { departments: [], designations: [] };
  }
}

export async function addDropdownOption(type: 'department' | 'designation', value: string): Promise<boolean> {
  try {
    const sheets = await getSheetsClient();
    
    // 1. Fetch current dropdown sheet content to find headers and next empty row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${DROPDOWN_SHEET_NAME}!A1:Z100`, // Scan enough rows
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      console.error("Dropdown sheet is empty or headers missing.");
      return false;
    }

    const headers = (rows[0] || []).map((h: any) => String(h).toLowerCase().trim());
    const index = headers.indexOf(type.toLowerCase());
    
    if (index === -1) {
      console.error(`Header "${type}" not found. Available headers: ${headers.join(", ")}`);
      return false;
    }

    // 2. Determine the first empty row in the specific target column
    let lastUsedRowIndex = 0; // Row index 0 is headers
    for (let i = 0; i < rows.length; i++) {
      const cellValue = rows[i][index];
      if (cellValue !== undefined && String(cellValue).trim() !== "") {
        lastUsedRowIndex = i;
      }
    }
    const targetRowNumber = lastUsedRowIndex + 2; // Next row (1-based + 1)
    const columnLetter = getColumnLetter(index + 1);
    const targetRange = `${DROPDOWN_SHEET_NAME}!${columnLetter}${targetRowNumber}`;

    // 3. Write specifically to that cell
    await sheets.spreadsheets.values.update({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: targetRange,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[value]],
      },
    });

    return true;
  } catch (error) {
    console.error(`Error adding ${type} option:`, error);
    return false;
  }
}
