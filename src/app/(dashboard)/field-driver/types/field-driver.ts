export type FieldTab = 'TRACKING' | 'ADMIN_MAP' | 'ADMIN_TABLE' | 'ADMIN_REPORT';
export type FieldStatus = 'IDLE' | 'CHECKED_IN' | 'COMPLETED';
export type FormAction = 'CHECK_IN' | 'CHECK_OUT';

export type VerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'LOW_GPS'
  | 'SUSPICIOUS_ODO'
  | 'NO_MOVEMENT';

export interface FieldUser {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  role?: string;
  image?: string;
}

export interface LiveCoords {
  lat: number;
  lng: number;
}

export interface LivePing {
  time: string;
  lat: string;
  lng: string;
}

export interface FieldDriverRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  inTime: string;
  outTime: string;
  status: string;
  inLocation: string;
  outLocation: string;
  odometerIn: string;
  odometerOut: string;
  odometerPhotoIn: string;
  odometerPhotoOut: string;
  totalKm: string;
}

export interface LiveLocationRecord {
  userId: string;
  userName: string;
  date: string;
  pathData: string;
}

export interface ActivityEvent {
  id: string;
  type: 'check_in' | 'live_location' | 'journey_started' | 'check_out';
  title: string;
  time: string;
  detail?: string;
}
