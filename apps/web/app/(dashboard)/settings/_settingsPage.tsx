"use client";

import { useState } from "react";
import {
  useAuthenticatedQuery,
  useAuthenticatedMutation,
} from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Save, Settings2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "convex/react";

const settingsSchema = z.object({
  nearbyRadius: z.coerce
    .number()
    .min(100, "Min 100 meters")
    .max(50000, "Max 50km"),
  arrivedDistance: z.coerce.number().min(10, "Min 10 meters").max(1000),
  driverResponseTime: z.coerce.number().min(5, "Min 5 seconds").max(120),
  maxDriverRideRequests: z.coerce.number().min(1).max(10).optional(),
  cancellationPenalty: z.coerce.number().min(0).optional(),
});

const ageSettingsSchema = z
  .object({
    minDriverAge: z.coerce
      .number()
      .min(1, "Min age must be at least 1")
      .max(150, "Max age cannot exceed 150"),
    maxDriverAge: z.coerce
      .number()
      .min(1, "Max age must be at least 1")
      .max(150, "Max age cannot exceed 150")
      .optional()
      .nullable(),
    minRiderAge: z.coerce
      .number()
      .min(1, "Min age must be at least 1")
      .max(150, "Max age cannot exceed 150"),
    maxRiderAge: z.coerce
      .number()
      .min(1, "Max age must be at least 1")
      .max(150, "Max age cannot exceed 150")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.maxDriverAge != null) {
        return data.maxDriverAge > data.minDriverAge;
      }
      return true;
    },
    {
      message: "Maximum driver age must be greater than minimum driver age",
      path: ["maxDriverAge"],
    },
  )
  .refine(
    (data) => {
      if (data.maxRiderAge != null) {
        return data.maxRiderAge > data.minRiderAge;
      }
      return true;
    },
    {
      message: "Maximum rider age must be greater than minimum rider age",
      path: ["maxRiderAge"],
    },
  );

type SettingsForm = z.infer<typeof settingsSchema>;
type AgeSettingsForm = z.infer<typeof ageSettingsSchema>;

function FieldGroup({
  label,
  description,
  suffix,
  error,
  id,
  ...inputProps
}: {
  label: string;
  description?: string;
  suffix?: string;
  error?: string;
  id: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      <div className="flex items-center gap-0">
        <Input
          id={id}
          type="number"
          className="flex-1 h-10 px-3 rounded-l-lg rounded-r-none border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
          {...inputProps}
        />
        {suffix && (
          <span className="h-10 px-3 flex items-center border border-l-0 border-input rounded-r-lg bg-muted text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export function SettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingAge, setIsSubmittingAge] = useState(false);

  const settings = useAuthenticatedQuery(
    api.routes.settings.rideSettings,
  ) as any;
  const ageSettings = useQuery(api.routes.settings.getUserAgeSettings);

  const addSettings = useAuthenticatedMutation(
    api.routes.settings.addRideSettings,
  );
  const updateSettings = useAuthenticatedMutation(
    api.routes.settings.updateRideSettings,
  );

  const setAgeSettings = useAuthenticatedMutation(
    api.routes.settings.setUserAgeSettings,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    values: settings
      ? {
          nearbyRadius: settings.nearbyRadius,
          arrivedDistance: settings.arrivedDistance,
          driverResponseTime: settings.driverResponseTime,
          maxDriverRideRequests: settings.maxDriverRideRequests,
          cancellationPenalty: settings.cancellationPenalty,
        }
      : undefined,
  });

  const {
    register: registerAge,
    handleSubmit: handleSubmitAge,
    formState: { errors: errorsAge },
    reset: resetAge,
  } = useForm<AgeSettingsForm>({
    resolver: zodResolver(ageSettingsSchema),
    values: ageSettings
      ? {
          minDriverAge: ageSettings.minDriverAge,
          maxDriverAge: ageSettings.maxDriverAge ?? null,
          minRiderAge: ageSettings.minRiderAge,
          maxRiderAge: ageSettings.maxRiderAge ?? null,
        }
      : {
          minDriverAge: 18,
          maxDriverAge: 100,
          minRiderAge: 10,
          maxRiderAge: null,
        },
  });

  const onSubmit = async (data: SettingsForm) => {
    setIsSubmitting(true);
    try {
      if (settings?._id) {
        await updateSettings({
          id: settings._id,
          nearbyRadius: data.nearbyRadius,
          arrivedDistance: data.arrivedDistance,
          driverResponseTime: data.driverResponseTime,
          maxDriverRideRequests: data.maxDriverRideRequests,
          cancellationPenalty: data.cancellationPenalty,
        });
      } else {
        await addSettings({
          nearbyRadius: data.nearbyRadius,
          arrivedDistance: data.arrivedDistance,
          driverResponseTime: data.driverResponseTime,
          maxDriverRideRequests: data.maxDriverRideRequests,
          cancellationPenalty: data.cancellationPenalty,
        });
      }
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitAge = async (data: AgeSettingsForm) => {
    setIsSubmittingAge(true);
    try {
      const payload = {
        minDriverAge: data.minDriverAge,
        maxDriverAge: data.maxDriverAge ?? undefined,
        minRiderAge: data.minRiderAge,
        maxRiderAge: data.maxRiderAge ?? undefined,
      };
      await setAgeSettings(payload);
      toast.success("Age settings saved successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save age settings",
      );
    } finally {
      setIsSubmittingAge(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="page-header">
        <h1 className="page-title">Platform Settings</h1>
        <p className="page-description">
          Configure global ride platform and user validation parameters
        </p>
      </div>

      {/* Ride Settings */}
      {settings === undefined ? (
        <div className="card-glass p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="card-glass p-6 space-y-5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Ride Settings</h2>
              <p className="text-xs text-muted-foreground">
                Changes apply immediately to all drivers and riders
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <FieldGroup
              id="nearbyRadius"
              label="Nearby Radius"
              description="Radius to search for nearby drivers"
              suffix="meters"
              placeholder="5000"
              error={errors.nearbyRadius?.message}
              {...register("nearbyRadius")}
            />
            <FieldGroup
              id="arrivedDistance"
              label="Arrived Distance"
              description="How close driver must be to mark arrived"
              suffix="meters"
              placeholder="200"
              error={errors.arrivedDistance?.message}
              {...register("arrivedDistance")}
            />
            <FieldGroup
              id="driverResponseTime"
              label="Driver Response Time"
              description="Time driver has to accept a request"
              suffix="seconds"
              placeholder="30"
              error={errors.driverResponseTime?.message}
              {...register("driverResponseTime")}
            />
            <FieldGroup
              id="maxDriverRideRequests"
              label="Max Driver Requests"
              description="Max simultaneous requests per driver"
              suffix="requests"
              placeholder="3"
              error={errors.maxDriverRideRequests?.message}
              {...register("maxDriverRideRequests")}
            />
            <FieldGroup
              id="cancellationPenalty"
              label="Cancellation Penalty"
              description="Fee charged on cancellation (₹)"
              suffix="₹"
              placeholder="50"
              error={errors.cancellationPenalty?.message}
              {...register("cancellationPenalty")}
            />
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSubmitting ? "Saving…" : "Save Settings"}
            </Button>
            <Button type="button" variant="outline" onClick={() => reset()}>
              Reset
            </Button>
          </div>
        </form>
      )}

      {/* Age Validation Settings */}
      {ageSettings === undefined ? (
        <div className="card-glass p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <form
          onSubmit={handleSubmitAge(onSubmitAge)}
          className="card-glass p-6 space-y-5"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-semibold">User Age Validation</h2>
              <p className="text-xs text-muted-foreground">
                Configure age restrictions for drivers and riders
              </p>
            </div>
          </div>

          <div className="space-y-5 pt-2">
            {/* Driver Age Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Driver Age Requirements
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup
                  id="minDriverAge"
                  label="Minimum Age"
                  description="Minimum age to register as driver"
                  suffix="years"
                  placeholder="18"
                  error={errorsAge.minDriverAge?.message}
                  {...registerAge("minDriverAge")}
                />
                <div className="space-y-1.5">
                  <Label
                    htmlFor="hasMaxDriverAge"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Set Maximum Age
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Maximum age to register as driver
                  </p>
                  <FieldGroup
                    id="maxDriverAge"
                    label=""
                    suffix="years"
                    placeholder="100"
                    error={errorsAge.maxDriverAge?.message}
                    {...registerAge("maxDriverAge")}
                  />
                </div>
              </div>
            </div>

            {/* Rider Age Settings */}
            <div className="space-y-3 pt-3 border-t border-border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Rider Age Requirements
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup
                  id="minRiderAge"
                  label="Minimum Age"
                  description="Minimum age to register as rider"
                  suffix="years"
                  placeholder="10"
                  error={errorsAge.minRiderAge?.message}
                  {...registerAge("minRiderAge")}
                />
                <div className="space-y-1.5">
                  <Label
                    htmlFor="hasMaxRiderAge"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Set Maximum Age
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Maximum age to register as rider
                  </p>
                  <FieldGroup
                    id="maxRiderAge"
                    label=""
                    suffix="years"
                    placeholder="No limit"
                    error={errorsAge.maxRiderAge?.message}
                    {...registerAge("maxRiderAge")}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <Button
              type="submit"
              disabled={isSubmittingAge}
              className="flex items-center gap-2"
            >
              {isSubmittingAge ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSubmittingAge ? "Saving…" : "Save Age Settings"}
            </Button>
            <Button type="button" variant="outline" onClick={() => resetAge()}>
              Reset
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
