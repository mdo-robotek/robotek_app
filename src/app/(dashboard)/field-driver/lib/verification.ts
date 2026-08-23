import { calculateDistance } from '@/lib/locationUtils';
import type { VerificationStatus } from '../types/field-driver';

export function calculateTotalGpsDistanceKm(pathDataJSON: string): number {
  try {
    const points = JSON.parse(pathDataJSON);
    if (!Array.isArray(points) || points.length < 2) return 0;

    let totalMetres = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      totalMetres += calculateDistance(
        parseFloat(p1.lat),
        parseFloat(p1.lng),
        parseFloat(p2.lat),
        parseFloat(p2.lng)
      );
    }
    return totalMetres / 1000;
  } catch {
    return 0;
  }
}

export function getVerificationStatus(
  record: { status?: string; outTime?: string; totalKm?: string },
  gpsKm: number
): { status: VerificationStatus; percentDiff: number | null } {
  const odoKm = parseFloat(record.totalKm || '') || 0;

  if (!record.outTime && record.status !== 'COMPLETED') {
    return { status: 'PENDING', percentDiff: null };
  }

  if (odoKm === 0 && gpsKm === 0) {
    return { status: 'NO_MOVEMENT', percentDiff: 0 };
  }

  const diff = Math.abs(odoKm - gpsKm);
  const percentDiff = odoKm > 0 ? (diff / odoKm) * 100 : 100;

  if (percentDiff <= 25) {
    return { status: 'VERIFIED', percentDiff };
  }
  if (gpsKm > odoKm) {
    return { status: 'SUSPICIOUS_ODO', percentDiff };
  }
  return { status: 'LOW_GPS', percentDiff };
}

export function drivePhotoUrl(fileIdOrUrl: string): string {
  if (!fileIdOrUrl) return '';
  if (fileIdOrUrl.startsWith('http') || fileIdOrUrl.startsWith('data:')) return fileIdOrUrl;
  return `https://drive.google.com/thumbnail?id=${fileIdOrUrl}&sz=w800`;
}
