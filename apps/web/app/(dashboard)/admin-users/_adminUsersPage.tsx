"use client";

import { useState } from "react";
import { useAuthenticatedQuery, useAuthenticatedMutation } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, formatTimeAgo, getInitials } from "@/lib/utils";
import { Plus, Trash2, UserCog, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type AdminUser = {
  _id: string;
  _creationTime: number;
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  gender: string;
  permissionId: string;
  profilePictureKey?: string;
};

function AdminColumns(
  onDelete: (permId: string, name: string) => void,
): ColumnDef<AdminUser>[] {
  return [
    {
      id: "avatar",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold overflow-hidden">
            {u.profilePictureKey ? (
              <img
                src={u.profilePictureKey}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              getInitials(u.firstName, u.lastName)
            )}
          </div>
        );
      },
    },
    {
      id: "name",
      header: "Name",
      accessorFn: (u) => `${u.firstName} ${u.lastName ?? ""}`.trim(),
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div>
            <p className="font-medium">
              {u.firstName} {u.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{u.phoneNumber}</p>
          </div>
        );
      },
    },
    {
      id: "gender",
      header: "Gender",
      accessorFn: (u) => u.gender,
    },
    {
      id: "joined",
      header: "Added",
      accessorFn: (u) => u._creationTime,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.original._creationTime)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const u = row.original;
        const name = `${u.firstName} ${u.lastName ?? ""}`.trim();
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(u.permissionId, name);
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 text-muted-foreground transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        );
      },
    },
  ];
}

const createAdminSchema = z.object({
  phoneNumber: z.string().min(10, "Enter a valid phone number"),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().optional(),
  dob: z.string().min(1, "Date of birth required"),
  gender: z.enum(["Male", "Female", "Other"]),
});

type CreateAdminForm = z.infer<typeof createAdminSchema>;

function CreateAdminModal({ onClose }: { onClose: () => void }) {
  const createAdmin = useAuthenticatedMutation(api.routes.admin.createAdminUser);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAdminForm>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { gender: "Male" },
  });

  const onSubmit = async (data: CreateAdminForm) => {
    setIsSubmitting(true);
    try {
      await createAdmin(data);
      toast.success("Admin user created successfully");
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create admin",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <UserCog className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Add Admin User</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">
                First Name
              </label>
              <input
                {...register("firstName")}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="John"
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
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Phone Number
            </label>
            <input
              {...register("phoneNumber")}
              type="tel"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="+91 9876543210"
            />
            {errors.phoneNumber && (
              <p className="text-destructive text-xs mt-1">
                {errors.phoneNumber.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Date of Birth
              </label>
              <input
                {...register("dob")}
                type="date"
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.dob && (
                <p className="text-destructive text-xs mt-1">
                  {errors.dob.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Gender</label>
              <select
                {...register("gender")}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            If a user with this phone number already exists, they will be
            granted Admin permission.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {isSubmitting ? "Creating…" : "Create Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  name,
  permissionId,
  onClose,
  onConfirm,
}: {
  name: string;
  permissionId: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteAdmin = useAuthenticatedMutation(api.routes.admin.deleteAdminUser);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAdmin({ permissionId: permissionId as any });
      toast.success("Admin permission removed");
      onConfirm();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove admin",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto">
          <Trash2 className="h-6 w-6 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="font-semibold text-lg">Remove Admin</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Remove admin permission from{" "}
            <span className="font-medium text-foreground">{name}</span>? Their
            account will remain but they won't be able to access the dashboard.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isDeleting ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

const filterFields = [
  {
    id: "gender",
    label: "Gender",
    options: [
      { label: "Male", value: "Male" },
      { label: "Female", value: "Female" },
      { label: "Other", value: "Other" },
    ],
  },
];

export function AdminUsersPage({
  initialAdmins,
}: {
  initialAdmins?: AdminUser[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<any[]>([]);

  const liveAdmins = useAuthenticatedQuery(
    api.routes.admin.getAllAdminUsers,
    {
      search: globalFilter || undefined,
    },
  ) as AdminUser[] | undefined;

  const admins = liveAdmins ?? (globalFilter ? undefined : initialAdmins);

  const columns = AdminColumns((permId, name) =>
    setDeleteTarget({ id: permId, name }),
  );

  return (
    <div>
      {showCreate && <CreateAdminModal onClose={() => setShowCreate(false)} />}
      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.name}
          permissionId={deleteTarget.id}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => setDeleteTarget(null)}
        />
      )}

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Admin Users</h1>
          <p className="page-description">
            {admins !== undefined
              ? `${admins.length} admin${admins.length !== 1 ? "s" : ""}`
              : "Loading…"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Admin
        </button>
      </div>

      <div className="card-glass p-4">
        <DataTable
          columns={columns}
          data={admins ?? []}
          isLoading={admins === undefined}
          searchPlaceholder="Search admins…"
          filterFields={filterFields}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          emptyTitle="No admin users"
          emptyDescription="Add the first admin user to get started"
        />
      </div>
    </div>
  );
}
