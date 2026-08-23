'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FieldDriverRecord, FieldStatus, FieldUser } from '../types/field-driver';

export function useFieldStatus() {
  const [user, setUser] = useState<FieldUser | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<FieldStatus>('IDLE');
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [odometerInValue, setOdometerInValue] = useState('');
  const [todayRecord, setTodayRecord] = useState<FieldDriverRecord | null>(null);

  const fetchAttendanceStatus = useCallback(async (userId: string) => {
    const res = await fetch(`/api/field-driver?userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setCurrentStatus(data.currentStatus);
      if (data.lastCheckIn) setCheckInTime(new Date(data.lastCheckIn));
      if (data.odometerIn) setOdometerInValue(data.odometerIn);
      setTodayRecord(data.todayRecord || null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const authRes = await fetch('/api/auth/session');
        const session = await authRes.json();
        if (session?.user) {
          setUser(session.user);
          await fetchAttendanceStatus(session.user.id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsPageLoading(false);
      }
    };
    init();
  }, [fetchAttendanceStatus]);

  return {
    user,
    isPageLoading,
    currentStatus,
    checkInTime,
    odometerInValue,
    todayRecord,
    fetchAttendanceStatus,
    isAdmin: user?.role?.toLowerCase() === 'admin',
  };
}
