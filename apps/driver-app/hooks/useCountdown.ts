import { useEffect, useState } from 'react';

type UseCountdownOptions = {
  initialTime: number; // seconds
  autoStart?: boolean;
  onComplete?: () => void;
};

export function useCountdown({
  initialTime,
  autoStart = true,
  onComplete,
}: UseCountdownOptions) {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) {
      if (timeLeft === 0) onComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isRunning, timeLeft, onComplete]);

  const start = () => setIsRunning(true);

  const stop = () => setIsRunning(false);

  const reset = (newTime?: number) => {
    setTimeLeft(newTime ?? initialTime);
    setIsRunning(autoStart);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const formattedTime = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return {
    timeLeft,
    formattedTime,
    isRunning,
    start,
    stop,
    reset,
  };
}