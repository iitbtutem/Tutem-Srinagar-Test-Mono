
export const VERIFICATION_CONFIG = {
  Verified: {
    icon: 'check-circle',
    color: '#10b981',
    label: 'Verified',
  },
  Pending: {
    icon: 'clock',
    color: '#ed921c', // yellow-500
    label: 'Pending',
  },
  Rejected: {
    icon: 'x-circle',
    color: '#ef4444',
    label: 'Rejected',
  },
} as const;
