export interface LocationEntry {
  name: string;
  coords: string;
}

export interface User {
  id: string; // Used as Employee Code
  username: string;
  email: string;
  full_name?: string;
  password?: string;
  phone?: string;
  role_name?: string;
  late_long?: string; // Stringified JSON array of LocationEntry
  image_url?: string;
  dob?: string;
  anniversary_date?: string;
  doj?: string;
  office?: string;
  designation?: string;
  department?: string;
  last_active?: string;
  isActive?: boolean;
  /** Whether this user's attendance is maintained on the ERP (daily attendance widgets).
   * Factory-floor staff whose attendance is tracked elsewhere (face scanner, etc.)
   * are kept Active for ERP access but excluded here. Defaults to true unless "No". */
  trackAttendance?: boolean;
  permissions?: string[];
  locations?: LocationEntry[]; // Added for UI convenience
}
