import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export const useInternet = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOnline(
        !!state.isConnected &&
        !!state.isInternetReachable
      );
      setChecked(true);
    });

    return unsub;
  }, []);

  return { isOnline, checked };
};