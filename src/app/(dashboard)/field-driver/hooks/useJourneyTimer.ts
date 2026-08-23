'use client';

import { useEffect, useState } from 'react';
import type { FieldStatus } from '../types/field-driver';

export function useJourneyTimer(currentStatus: FieldStatus, checkInTime: Date | null) {
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (currentStatus === 'CHECKED_IN' && checkInTime) {
      interval = setInterval(() => {
        const diff = Date.now() - checkInTime.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    } else {
      setElapsedTime('00:00:00');
    }
    return () => clearInterval(interval);
  }, [currentStatus, checkInTime]);

  return elapsedTime;
}
