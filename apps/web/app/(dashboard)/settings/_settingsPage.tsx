"use client";

import { useState, useRef } from "react";
import {
  useAuthenticatedQuery,
  useAuthenticatedMutation,
  useAuthenticatedAction,
} from "@/hooks/customApi";
import { api } from "@tutem/api";
import type { Id } from "@tutem/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Settings2,
  Users,
  Video,
  Plus,
  Pencil,
  Trash2,
  ImageIcon,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "convex/react";

/**
 * Extracts a YouTube video ID from a bare ID or any YouTube URL.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/
 * Returns null if the input is not a recognisable YouTube reference.
 */
function getYoutubeId(input: string): string | null {
  if (!input) return null;
  if (!input.includes("/") && !input.includes("?")) return input;
  try {
    const url = new URL(input);
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    if (url.pathname.startsWith("/shorts/"))
      return url.pathname.split("/shorts/")[1];
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

const settingsSchema = z.object({
  nearbyRadius: z.coerce
    .number()
    .min(100, "Min 100 meters")
    .max(50000, "Max 50km"),
  arrivedDistance: z.coerce.number().min(10, "Min 10 meters").max(1000),
  driverResponseTime: z.coerce.number().min(1, "Min 1 minute").max(120),
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

const videoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  videoUrl: z.string().min(1, "Video URL or YouTube ID is required"),
  status: z.enum(["Active", "Inactive"]),
});

type SettingsForm = z.infer<typeof settingsSchema>;
type AgeSettingsForm = z.infer<typeof ageSettingsSchema>;
type VideoForm = z.infer<typeof videoSchema>;

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

type VideoRecord = {
  _id: Id<"userHomeScreenVideos">;
  title: string;
  description?: string;
  videoUrl: string;
  status: "Active" | "Inactive";
};

function VideoFormDialog({
  open,
  onClose,
  editing,
  onSave,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  editing: VideoRecord | null;
  onSave: (data: VideoForm) => Promise<void>;
  isSaving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VideoForm>({
    resolver: zodResolver(videoSchema),
    values: editing
      ? {
          title: editing.title,
          description: editing.description ?? "",
          videoUrl: editing.videoUrl,
          status: editing.status,
        }
      : { title: "", description: "", videoUrl: "", status: "Active" },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Video" : "Add Video"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="video-title">Title</Label>
            <Input
              id="video-title"
              placeholder="e.g. Ride Booking"
              {...register("title")}
            />
            {errors.title && (
              <p className="text-destructive text-xs">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="video-desc">Description (optional)</Label>
            <Input
              id="video-desc"
              placeholder="e.g. Watch quick ride booking insights"
              {...register("description")}
            />
          </div>

          {/* Video URL */}
          <div className="space-y-1.5">
            <Label htmlFor="video-url">YouTube Video ID or Full URL</Label>
            <Input
              id="video-url"
              placeholder="e.g. theytLvdnaE or https://..."
              {...register("videoUrl")}
            />
            {errors.videoUrl && (
              <p className="text-destructive text-xs">
                {errors.videoUrl.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter a bare YouTube ID (e.g. <code>theytLvdnaE</code>) or any
              full video URL
            </p>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="video-status">Status</Label>
            <select
              id="video-status"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
              {...register("status")}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? "Saving…" : editing ? "Update" : "Add Video"}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingAge, setIsSubmittingAge] = useState(false);

  // Video modal state
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoRecord | null>(null);
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  const [isSavingFooter, setIsSavingFooter] = useState(false);
  const [isDeletingFooter, setIsDeletingFooter] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const footerFileInputRef = useRef<HTMLInputElement>(null);

  const settings = useAuthenticatedQuery(
    api.routes.settings.rideSettings,
  ) as any;
  const ageSettings = useQuery(api.routes.settings.getUserAgeSettings);
  const allVideos = useAuthenticatedQuery(
    api.routes.settings.getAllHomeScreenVideos,
  );
  const footerImage = useQuery(api.routes.settings.getHomeScreenFooterImage);

  const addSettings = useAuthenticatedMutation(
    api.routes.settings.addRideSettings,
  );
  const updateSettings = useAuthenticatedMutation(
    api.routes.settings.updateRideSettings,
  );
  const setAgeSettings = useAuthenticatedMutation(
    api.routes.settings.setUserAgeSettings,
  );

  const addVideo = useAuthenticatedMutation(
    api.routes.settings.addHomeScreenVideo,
  );
  const updateVideo = useAuthenticatedMutation(
    api.routes.settings.updateHomeScreenVideo,
  );
  const deleteVideo = useAuthenticatedMutation(
    api.routes.settings.deleteHomeScreenVideo,
  );

  const getPresignedUrl = useAuthenticatedAction(
    api.actions.upload.getPresignedUrl,
  );
  const setFooterImage = useAuthenticatedMutation(
    api.routes.settings.setHomeScreenFooterImage,
  );
  const deleteFooterImage = useAuthenticatedMutation(
    api.routes.settings.deleteHomeScreenFooterImage,
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

  // Footer image: select → preview locally → Save → upload + persist
  // displayPreview: local blob while a file is pending, signed URL from DB query otherwise
  const displayPreview = previewBlobUrl ?? footerImage?.signedUrl ?? null;

  const onSubmit = async (data: SettingsForm) => {
    setIsSubmitting(true);
    try {
      if (settings?._id) {
        await updateSettings({ id: settings._id, ...data });
      } else {
        await addSettings(data);
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
      await setAgeSettings({
        minDriverAge: data.minDriverAge,
        maxDriverAge: data.maxDriverAge ?? undefined,
        minRiderAge: data.minRiderAge,
        maxRiderAge: data.maxRiderAge ?? undefined,
      });
      toast.success("Age settings saved successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save age settings",
      );
    } finally {
      setIsSubmittingAge(false);
    }
  };

  const onSaveVideo = async (data: VideoForm) => {
    setIsSavingVideo(true);
    try {
      if (editingVideo) {
        await updateVideo({ id: editingVideo._id, ...data });
        toast.success("Video updated");
      } else {
        await addVideo(data);
        toast.success("Video added");
      }
      setVideoDialogOpen(false);
      setEditingVideo(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save video");
    } finally {
      setIsSavingVideo(false);
    }
  };

  const onDeleteVideo = async (id: Id<"userHomeScreenVideos">) => {
    try {
      await deleteVideo({ id });
      toast.success("Video deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete video",
      );
    }
  };

  // Pick file → store locally + show blob preview (no network call)
  const handleFooterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5 MB");
      return;
    }

    // Revoke old blob to avoid memory leaks
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);

    setPendingFile(file);
    setPreviewBlobUrl(URL.createObjectURL(file));
    if (footerFileInputRef.current) footerFileInputRef.current.value = "";
  };

  // Save Image: upload to Minio THEN persist URL to DB
  const onConfirmFooter = async () => {
    if (!pendingFile) return;
    setIsSavingFooter(true);
    const toastId = toast.loading("Uploading and saving…");
    try {
      const key = `home-screen/footer-${Date.now()}.${pendingFile.name.split(".").pop()}`;
      const presigned = await getPresignedUrl({
        key,
        contentType: pendingFile.type,
      });

      const res = await fetch(presigned.url, {
        method: "PUT",
        headers: { "Content-Type": pendingFile.type },
        body: pendingFile,
      });
      if (!res.ok) throw new Error("Upload to storage server failed");

      const endpoint = (process.env.NEXT_PUBLIC_MINIO_ENDPOINT ?? "").replace(
        /\/$/,
        "",
      );
      const bucket = process.env.NEXT_PUBLIC_MINIO_BUCKET ?? "";
      const publicUrl = `${endpoint}/${bucket}/${presigned.key}`;

      await setFooterImage({ imageUrl: publicUrl, imageKey: presigned.key });

      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      setPendingFile(null);
      setPreviewBlobUrl(null);
      // footerImage query will re-fetch reactively and provide the signed URL for display
      toast.success("Footer image saved", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", {
        id: toastId,
      });
    } finally {
      setIsSavingFooter(false);
    }
  };

  const onDeleteFooter = async () => {
    setIsDeletingFooter(true);
    try {
      await deleteFooterImage({});
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      setPendingFile(null);
      setPreviewBlobUrl(null);
      toast.success("Footer image removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove footer image",
      );
    } finally {
      setIsDeletingFooter(false);
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
              suffix="minutes"
              placeholder="5"
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

      <div className="card-glass p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Video className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h2 className="font-semibold">Rider Home Screen Videos</h2>
              <p className="text-xs text-muted-foreground">
                Manage insight videos shown on the rider home screen
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => {
              setEditingVideo(null);
              setVideoDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Video
          </Button>
        </div>

        {allVideos === undefined ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : allVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border rounded-xl">
            <Video className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No videos yet</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Add videos that appear in the Insights section on the rider home
              screen
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {allVideos.map((video) => {
              const ytId = getYoutubeId(video.videoUrl);
              const thumb = ytId
                ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
                : null;

              return (
                <div
                  key={video._id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-5 w-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {video.title}
                    </p>
                    {video.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {video.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 truncate font-mono mt-0.5">
                      {video.videoUrl}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={cn(
                      "shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full",
                      video.status === "Active"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                    )}
                  >
                    {video.status === "Active" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {video.status}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingVideo(video as VideoRecord);
                        setVideoDialogOpen(true);
                      }}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDeleteVideo(video._id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card-glass p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="font-semibold">Rider Home Screen Footer Image</h2>
            <p className="text-xs text-muted-foreground">
              Banner image displayed at the bottom of the rider home screen
            </p>
          </div>
        </div>

        {footerImage === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-72 w-48 mx-auto rounded-3xl" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Dimension guide */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Recommended image dimensions
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                <span className="font-medium">Size</span>
                <span>1080 × 360 px</span>
                <span className="font-medium">Aspect ratio</span>
                <span>3 : 1 (banner)</span>
                <span className="font-medium">Format</span>
                <span>PNG or JPG, ≤ 5 MB</span>
              </div>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60">
                The image spans the full phone width. A 3:1 ratio ensures it
                fits every screen size without cropping or empty space.
              </p>
            </div>

            {/* File picker */}
            <div className="space-y-2">
              <input
                ref={footerFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFooterFileChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isSavingFooter}
                onClick={() => footerFileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border-dashed h-12"
              >
                <ImageIcon className="h-4 w-4" />{" "}
                {pendingFile
                  ? "Change Selected Image"
                  : displayPreview
                    ? "Replace Image"
                    : "Choose Image"}
              </Button>
            </div>

            {/* Phone mockup — always visible so admin sees the layout */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Preview — as seen on rider&apos;s phone
              </p>

              <div className="flex justify-center">
                <div
                  className="relative bg-black rounded-[2.5rem] border-[6px] border-gray-800 shadow-2xl overflow-hidden"
                  style={{ width: 240, height: 420 }}
                >
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />

                  {/* Screen */}
                  <div className="w-full h-full bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
                    {/* Status bar */}
                    <div className="h-6 bg-primary" />

                    {/* App header */}
                    <div className="flex items-center gap-2 px-2 w-24 bg-muted rounded-br-xl">
                      <div className="h-4 w-4 rounded-full border border-green-600 flex items-center justify-center p-1">
                        <p className="text-[10px]">R</p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[10px] -mb-0.5">Hello</p>
                        <p className="text-[10px] -mt-0.5">Rider</p>
                      </div>
                    </div>

                    {/* Scrollable content */}
                    <div className="flex-1 bg-background px-2 py-2 space-y-2 overflow-hidden">
                      <p className="text-md font-bold">Ride Services</p>
                      <div className="grid grid-cols-3 gap-1">
                        {[...Array(3)].map((_, i) => (
                          <div
                            key={i}
                            className="aspect-square rounded-lg bg-primary/10"
                          />
                        ))}
                      </div>
                      <div className="h-2 w-16 bg-muted rounded-full" />
                      <div className="h-14 rounded-lg bg-muted/60" />
                      <div className="space-y-1 pt-1">
                        <div className="h-2 w-28 bg-muted rounded-full mx-auto" />
                        <div className="h-2 w-20 bg-muted rounded-full mx-auto" />
                      </div>
                    </div>

                    {/* ── Footer image — fixed above tab bar, matching rider app ── */}
                    <div
                      className="w-full bg-white overflow-hidden shrink-0"
                      style={{ aspectRatio: "3/1" }}
                    >
                      {displayPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={displayPreview}
                          alt="Footer banner preview"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center border border-dashed border-muted-foreground/20">
                          <p className="text-[9px] text-muted-foreground/40">
                            No image set
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom tab bar */}
                    <div className="h-8 border-t border-border bg-background flex items-center justify-around px-4 shrink-0">
                      {[...Array(2)].map((_, i) => (
                        <div
                          key={i}
                          className="h-3 w-3 rounded-full bg-muted"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action bar */}
            {(pendingFile || footerImage) && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                {/* Save Image — only shown when a file is selected but not yet saved */}
                {pendingFile && (
                  <Button
                    type="button"
                    disabled={isSavingFooter}
                    onClick={onConfirmFooter}
                    className="flex items-center gap-2"
                  >
                    {isSavingFooter ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isSavingFooter ? "Saving…" : "Save Image"}
                  </Button>
                )}

                {/* Discard — clear the selected file without touching DB */}
                {pendingFile && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSavingFooter}
                    onClick={() => {
                      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
                      setPendingFile(null);
                      setPreviewBlobUrl(null);
                    }}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Discard
                  </Button>
                )}

                {/* Remove — deletes saved image from DB */}
                {footerImage && !pendingFile && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isDeletingFooter}
                    onClick={onDeleteFooter}
                    className="flex items-center gap-2 text-destructive hover:text-destructive"
                  >
                    {isDeletingFooter ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    {isDeletingFooter ? "Removing…" : "Remove Image"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Video form dialog */}
      <VideoFormDialog
        open={videoDialogOpen}
        onClose={() => {
          setVideoDialogOpen(false);
          setEditingVideo(null);
        }}
        editing={editingVideo}
        onSave={onSaveVideo}
        isSaving={isSavingVideo}
      />
    </div>
  );
}
