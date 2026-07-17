"use client";

import { useState, useRef } from "react";
import { useAuthenticatedQuery, useAuthenticatedMutation, useAuthenticatedAction } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, User, Save, Camera } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profile = useAuthenticatedQuery(api.routes.admin.getAdminProfile) as any;

  const updateProfile = useAuthenticatedMutation(api.routes.admin.updateAdminProfile);
  const getPresignedUrl = useAuthenticatedAction(api.actions.upload.getPresignedUrl);
  const updateProfilePicture = useAuthenticatedMutation(
    api.routes.admin.updateAdminProfilePicture,
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile
      ? { firstName: profile.firstName, lastName: profile.lastName ?? "" }
      : undefined,
  });

  const onSubmit = async (data: ProfileForm) => {
    setIsSubmitting(true);
    try {
      await updateProfile(data);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update profile",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Uploading profile picture...");

    try {
      const key = `profiles/${profile._id}-${Date.now()}-${file.name}`;
      const presigned = await getPresignedUrl({
        key,
        contentType: file.type,
      });

      const res = await fetch(presigned.url, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!res.ok) {
        throw new Error("Failed to upload to storage server");
      }

      await updateProfilePicture({
        profilePictureKey: presigned.key,
      });

      toast.success("Profile picture updated successfully", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to upload profile picture",
        { id: toastId },
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (profile === undefined) {
    return (
      <div className="max-w-xl space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const name = profile
    ? `${profile.firstName} ${profile.lastName ?? ""}`.trim()
    : "Admin";

  return (
    <div className="max-w-xl space-y-5">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
        <p className="page-description">
          Manage your admin account information
        </p>
      </div>

      {/* Avatar card */}
      <div className="card-glass p-6 flex items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold ring-4 ring-primary/20 overflow-hidden">
            {profile?.profilePictureKey ? (
              <img
                src={profile.profilePictureKey}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              getInitials(profile?.firstName ?? "A", profile?.lastName)
            )}
          </div>
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer animate-in fade-in zoom-in duration-200"
            title="Upload profile picture"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-lg">{name}</h2>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5 flex-wrap">
            <span>{profile?.phoneNumber}</span>
            <span className="text-muted-foreground/30">•</span>
            <span className="text-xs">Joined {new Date(profile._creationTime).toLocaleDateString()}</span>
          </p>
          <div className="mt-1">
            <span className="badge-status bg-primary/10 text-primary inline-flex">
              Administrator
            </span>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="card-glass p-6">
        <h3 className="font-semibold mb-4">Personal Information</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                First Name
              </label>
              <input
                {...register("firstName")}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.firstName && (
                <p className="text-destructive text-xs mt-1">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Last Name
              </label>
              <input
                {...register("lastName")}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Phone Number
            </label>
            <input
              value={profile?.phoneNumber ?? ""}
              disabled
              className="w-full h-10 px-3 rounded-lg border border-input bg-muted text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Phone number cannot be changed here
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Gender</label>
            <input
              value={profile?.gender ?? ""}
              disabled
              className="w-full h-10 px-3 rounded-lg border border-input bg-muted text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div className="flex gap-3 pt-2 border-t border-border">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSubmitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
