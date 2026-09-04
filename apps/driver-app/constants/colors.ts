
export const VERIFICATION_CONFIG = {
  Verified: {
    icon: 'check-circle',
    color: '#10b981',
    label: 'Verified',
  },
  Unverified: {
    icon: 'clock',
    color: '#ed921c', // yellow-500
    label: 'Unverified',
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

export const colors = {
  primary: "#40a4f5",
  secondary: "#f59e0b",
  background: "#ffffff",
  pickup: "#3db858",
  destination: "#b0251e",
}
