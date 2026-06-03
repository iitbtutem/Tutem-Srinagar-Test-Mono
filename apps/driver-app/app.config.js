export default {
  expo: {
    name: "tutem-driver",
    slug: "tutem-driver",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "tutem-driver",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.driver.tutem",
      infoPlist: {
        NSCameraUsageDescription: "This app uses the camera to scan barcodes on event tickets.",
        NSLocationWhenInUseUsageDescription: "This app needs to access your location to track your ride.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app needs to access your location to track your ride.",
        UIBackgroundModes: ["location", "fetch"]
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_TESTING
      }
    },
    android: {
      softwareKeyboardLayoutMode: "pan",
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.driver.tutem",
      googleServicesFile: "./driver-google-services.json",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_TESTING
        }
      }
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "@react-native-community/datetimepicker",
      "@clerk/expo",
      "expo-secure-store",
      "expo-font",
      "expo-notifications",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location.",
          "isAndroidBackgroundLocationEnabled": true,
          "isIosBackgroundLocationEnabled": true
        }
      ]
    ],
    experiments: {
      "typedRoutes": true
    },
    extra: {
      router: {},
      eas: {
        projectId: "5975e692-ecf7-421f-aabb-3e6c78f69da6"
      },
      GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
    }
  }
};
