"use client";

import { useState } from "react";
import { useAuthenticatedQuery, useAuthenticatedMutation } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, Car, Bike, Bot } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type VehicleClass = "Bike" | "Auto" | "Cab";

const VEHICLE_CLASSES: VehicleClass[] = ["Bike", "Auto", "Cab"];

const vehicleIcons: Record<VehicleClass, React.ReactNode> = {
  Bike: <Bike className="h-4 w-4" />,
  Auto: <Bot className="h-4 w-4" />,
  Cab: <Car className="h-4 w-4" />,
};

const vehicleColors: Record<VehicleClass, string> = {
  Bike: "text-green-600 bg-green-50 dark:bg-green-900/20",
  Auto: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20",
  Cab: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
};

type Rate = {
  _id: string;
  vehicleClass: VehicleClass;
  baseDistance: number;
  baseDistanceRate: number;
  ratePerKm: number;
  waitingPerMinute: number;
  organizationId: string;
};

const rateSchema = z.object({
  vehicleClass: z.enum(["Bike", "Auto", "Cab"]),
  baseDistance: z.coerce.number().min(100, "Min 100m"),
  baseDistanceRate: z.coerce.number().min(0),
  ratePerKm: z.coerce.number().min(0),
  waitingPerMinute: z.coerce.number().min(0),
});

type RateForm = z.infer<typeof rateSchema>;

function RateFormModal({
  orgId,
  editRate,
  existingClasses,
  onClose,
}: {
  orgId: string;
  editRate?: Rate;
  existingClasses: VehicleClass[];
  onClose: () => void;
}) {
  const createRate = useAuthenticatedMutation(
    api.routes.organizations.createOrganizationRate,
  );
  const updateRate = useAuthenticatedMutation(
    api.routes.organizations.updateOrganizationRate,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RateForm>({
    resolver: zodResolver(rateSchema),
    defaultValues: editRate
      ? {
          vehicleClass: editRate.vehicleClass,
          baseDistance: editRate.baseDistance,
          baseDistanceRate: editRate.baseDistanceRate,
          ratePerKm: editRate.ratePerKm,
          waitingPerMinute: editRate.waitingPerMinute,
        }
      : { vehicleClass: "Cab" },
  });

  const availableClasses = editRate
    ? VEHICLE_CLASSES
    : VEHICLE_CLASSES.filter((c) => !existingClasses.includes(c));

  const onSubmit = async (data: RateForm) => {
    setIsSubmitting(true);
    try {
      if (editRate) {
        await updateRate({
          id: editRate._id as any,
          baseDistance: data.baseDistance,
          baseDistanceRate: data.baseDistanceRate,
          ratePerKm: data.ratePerKm,
          waitingPerMinute: data.waitingPerMinute,
        });
        toast.success("Rate updated");
      } else {
        await createRate({
          organizationId: orgId as any,
          vehicleClass: data.vehicleClass,
          baseDistance: data.baseDistance,
          baseDistanceRate: data.baseDistanceRate,
          ratePerKm: data.ratePerKm,
          waitingPerMinute: data.waitingPerMinute,
        });
        toast.success("Rate created");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save rate");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="rounded-2xl border shadow-2xl w-full max-w-md"
        style={{
          backgroundColor: "var(--color-card)",
          borderColor: "var(--color-border)",
        }}
      >
        <div
          className="p-5 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2 className="text-lg font-semibold">
            {editRate ? "Edit Rate" : "Add Vehicle Rate"}
          </h2>
          <p
            className="text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Configure pricing for a vehicle class
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* Vehicle class */}
          {!editRate && (
            <div>
              <label className="text-sm font-medium mb-1 block">
                Vehicle Class
              </label>
              <div className="grid grid-cols-3 gap-2">
                {availableClasses.map((cls) => (
                  <label key={cls} className="relative cursor-pointer">
                    <input
                      type="radio"
                      value={cls}
                      {...register("vehicleClass")}
                      className="sr-only peer"
                    />
                    <div
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all peer-checked:border-primary peer-checked:bg-primary/5"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <span className={`p-2 rounded-lg ${vehicleColors[cls]}`}>
                        {vehicleIcons[cls]}
                      </span>
                      <span className="text-sm font-medium">{cls}</span>
                    </div>
                  </label>
                ))}
              </div>
              {availableClasses.length === 0 && (
                <p
                  className="text-sm"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  All vehicle classes already have rates configured.
                </p>
              )}
            </div>
          )}

          {editRate && (
            <div
              className={`flex items-center gap-2 p-3 rounded-xl ${vehicleColors[editRate.vehicleClass]}`}
            >
              {vehicleIcons[editRate.vehicleClass]}
              <span className="font-medium">{editRate.vehicleClass}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "baseDistance",
                label: "Base Distance",
                suffix: "m",
                placeholder: "5000",
              },
              {
                id: "baseDistanceRate",
                label: "Base Rate",
                suffix: "₹",
                placeholder: "50",
              },
              {
                id: "ratePerKm",
                label: "Rate / km",
                suffix: "₹",
                placeholder: "12",
              },
              {
                id: "waitingPerMinute",
                label: "Waiting / min",
                suffix: "₹",
                placeholder: "2",
              },
            ].map(({ id, label, suffix, placeholder }) => (
              <div key={id}>
                <label className="text-sm font-medium mb-1 block">
                  {label}
                </label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.01"
                    placeholder={placeholder}
                    {...register(id as keyof RateForm)}
                    className="flex-1 h-10 px-3 rounded-l-lg border text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-0"
                    style={{
                      borderColor: "var(--color-input)",
                      backgroundColor: "var(--color-background)",
                    }}
                  />
                  <span
                    className="h-10 px-2.5 flex items-center rounded-r-lg border border-l-0 text-sm"
                    style={{
                      borderColor: "var(--color-input)",
                      backgroundColor: "var(--color-muted)",
                      color: "var(--color-muted-foreground)",
                    }}
                  >
                    {suffix}
                  </span>
                </div>
                {errors[id as keyof RateForm] && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--color-destructive)" }}
                  >
                    {errors[id as keyof RateForm]?.message as string}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border text-sm transition-colors hover:bg-muted"
              style={{ borderColor: "var(--color-border)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting || (!editRate && availableClasses.length === 0)
              }
              className="flex-1 h-10 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
              }}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Saving…" : editRate ? "Update" : "Add Rate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteRateModal({
  rate,
  onClose,
  onDone,
}: {
  rate: Rate;
  onClose: () => void;
  onDone: () => void;
}) {
  const deleteRate = useAuthenticatedMutation(
    api.routes.organizations.deleteOrganizationRate,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRate({ id: rate._id as any });
      toast.success("Rate deleted");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="rounded-2xl border shadow-2xl w-full max-w-sm p-6 space-y-4 text-center"
        style={{
          backgroundColor: "var(--color-card)",
          borderColor: "var(--color-border)",
        }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--color-destructive) 12%, transparent)",
          }}
        >
          <Trash2
            className="h-6 w-6"
            style={{ color: "var(--color-destructive)" }}
          />
        </div>
        <div>
          <h2 className="font-semibold text-lg">Delete Rate</h2>
          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Delete the{" "}
            <span
              className="font-medium"
              style={{ color: "var(--color-foreground)" }}
            >
              {rate.vehicleClass}
            </span>{" "}
            rate? This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border text-sm"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 h-10 rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--color-destructive)",
              color: "var(--color-destructive-foreground)",
            }}
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrgRatesPanel({ orgId }: { orgId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editRate, setEditRate] = useState<Rate | null>(null);
  const [deleteRate, setDeleteRate] = useState<Rate | null>(null);

  const rates = useAuthenticatedQuery(api.routes.organizations.getOrganizationRates, {
    organizationId: orgId as any,
  }) as Rate[] | undefined;

  const existingClasses = (rates ?? []).map((r) => r.vehicleClass);

  return (
    <div className="card-glass p-5">
      {showCreate && (
        <RateFormModal
          orgId={orgId}
          existingClasses={existingClasses}
          onClose={() => setShowCreate(false)}
        />
      )}
      {editRate && (
        <RateFormModal
          orgId={orgId}
          editRate={editRate}
          existingClasses={existingClasses}
          onClose={() => setEditRate(null)}
        />
      )}
      {deleteRate && (
        <DeleteRateModal
          rate={deleteRate}
          onClose={() => setDeleteRate(null)}
          onDone={() => setDeleteRate(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Vehicle Rates</h3>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Pricing per vehicle class
          </p>
        </div>
        {existingClasses.length < 3 && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
            }}
          >
            <Plus className="h-4 w-4" />
            Add Rate
          </button>
        )}
      </div>

      {rates === undefined ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl animate-pulse"
              style={{ backgroundColor: "var(--color-muted)" }}
            />
          ))}
        </div>
      ) : rates.length === 0 ? (
        <div className="text-center py-10">
          <Car
            className="h-10 w-10 mx-auto mb-3"
            style={{ color: "var(--color-muted-foreground)", opacity: 0.4 }}
          />
          <p
            className="text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            No rates configured yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {VEHICLE_CLASSES.filter((cls) => existingClasses.includes(cls)).map(
            (cls) => {
              const rate = rates.find((r) => r.vehicleClass === cls)!;
              return (
                <div
                  key={cls}
                  className="rounded-xl border p-4"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-lg ${vehicleColors[cls]}`}
                    >
                      {vehicleIcons[cls]}
                      {cls}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditRate(rate)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                      >
                        <Pencil
                          className="h-3.5 w-3.5"
                          style={{ color: "var(--color-muted-foreground)" }}
                        />
                      </button>
                      <button
                        onClick={() => setDeleteRate(rate)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2
                          className="h-3.5 w-3.5"
                          style={{ color: "var(--color-destructive)" }}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {[
                      {
                        label: "Base dist.",
                        value: `${(rate.baseDistance / 1000).toFixed(1)} km`,
                      },
                      {
                        label: "Base fare",
                        value: formatCurrency(rate.baseDistanceRate),
                      },
                      {
                        label: "Per km",
                        value: formatCurrency(rate.ratePerKm),
                      },
                      {
                        label: "Waiting/min",
                        value: formatCurrency(rate.waitingPerMinute),
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between">
                        <span
                          style={{ color: "var(--color-muted-foreground)" }}
                        >
                          {label}
                        </span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}
