"use client";

import { useState } from "react";
import { useAuthenticatedQuery, useAuthenticatedMutation } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { formatDate, getInitials } from "@/lib/utils";
import { Plus, Trash2, UserCog, Loader2, Pencil, ShieldCheck, Shield } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AdminUser = {
  _id: string;
  _creationTime: number;
  firstName: string;
  lastName?: string;
  phoneNumber: string;
  dob: string;
  gender: string;
  permissionId: string;
  isSuperAdmin: boolean;
  profilePictureKey?: string;
};

// â”€â”€â”€ Role Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RoleBadge({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  if (isSuperAdmin) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
        <ShieldCheck className="h-3 w-3" />
        Super Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      <Shield className="h-3 w-3" />
      Admin
    </span>
  );
}

// â”€â”€â”€ Table Columns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AdminColumns(
  isSuperAdmin: boolean,
  onDelete: (userId: string, name: string) => void,
  onEdit: (user: AdminUser) => void,
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
      id: "role",
      header: "Role",
      enableSorting: false,
      cell: ({ row }) => <RoleBadge isSuperAdmin={row.original.isSuperAdmin} />,
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
    ...(isSuperAdmin
      ? [
          {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }: { row: { original: AdminUser } }) => {
              const u = row.original;
              const name = `${u.firstName} ${u.lastName ?? ""}`.trim();
              return (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(u);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(u._id, name);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 text-muted-foreground transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            },
          } as ColumnDef<AdminUser>,
        ]
      : []),
  ];
}

// â”€â”€â”€ Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const adminUserSchema = z.object({
  phoneNumber: z.string().min(10, "Enter a valid phone number"),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().optional(),
  dob: z.string().min(1, "Date of birth required"),
  gender: z.enum(["Male", "Female", "Other"]),
  isSuperAdmin: z.boolean().optional(),
});

type AdminUserForm = z.infer<typeof adminUserSchema>;

// â”€â”€â”€ Create Admin Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CreateAdminModal({ onClose }: { onClose: () => void }) {
  const createAdmin = useAuthenticatedMutation(api.routes.admin.createAdminUser);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdminUserForm>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: { gender: "Male", isSuperAdmin: false },
  });

  const isSuperAdminChecked = watch("isSuperAdmin");

  const onSubmit = async (data: AdminUserForm) => {
    setIsSubmitting(true);
    try {
      await createAdmin({ ...data, isSuperAdmin: data.isSuperAdmin ?? false });
      toast.success("Admin user created successfully");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create admin");
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
              <Label className="text-sm font-medium mb-1 block">First Name</Label>
              <Input
                {...register("firstName")}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="John"
              />
              {errors.firstName && (
                <p className="text-destructive text-xs mt-1">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Last Name</Label>
              <Input
                {...register("lastName")}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1 block">Phone Number</Label>
            <Input
              {...register("phoneNumber")}
              type="tel"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="+91 9876543210"
            />
            {errors.phoneNumber && (
              <p className="text-destructive text-xs mt-1">{errors.phoneNumber.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">Date of Birth</Label>
              <Input
                {...register("dob")}
                type="date"
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.dob && (
                <p className="text-destructive text-xs mt-1">{errors.dob.message}</p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Gender</Label>
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

          <label className="flex items-center gap-3 p-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!isSuperAdminChecked}
              onChange={(e) => setValue("isSuperAdmin", e.target.checked)}
              className="w-4 h-4 accent-violet-600"
            />
            <div>
              <p className="text-sm font-medium text-violet-800 dark:text-violet-200 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Grant Super Admin
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                Can manage all admin users
              </p>
            </div>
          </label>

          <p className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            If a user with this phone number already exists, they will be granted the selected permission.
          </p>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-10">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Creatingâ€¦" : "Create Admin"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// â”€â”€â”€ Edit Admin Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EditAdminModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const updateAdmin = useAuthenticatedMutation(api.routes.admin.updateAdminUser);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdminUserForm>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName ?? "",
      phoneNumber: user.phoneNumber,
      dob: user.dob ?? "",
      gender: (user.gender as "Male" | "Female" | "Other") ?? "Male",
      isSuperAdmin: user.isSuperAdmin,
    },
  });

  const isSuperAdminChecked = watch("isSuperAdmin");

  const onSubmit = async (data: AdminUserForm) => {
    setIsSubmitting(true);
    try {
      await updateAdmin({
        userId: user._id as any,
        firstName: data.firstName,
        lastName: data.lastName,
        dob: data.dob,
        gender: data.gender,
        phoneNumber: data.phoneNumber,
        isSuperAdmin: data.isSuperAdmin ?? false,
      });
      toast.success("Admin user updated");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Pencil className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Edit Admin User</h2>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">First Name</Label>
              <Input {...register("firstName")} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              {errors.firstName && (
                <p className="text-destructive text-xs mt-1">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Last Name</Label>
              <Input {...register("lastName")} className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-1 block">Phone Number</Label>
            <Input
              {...register("phoneNumber")}
              type="tel"
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.phoneNumber && (
              <p className="text-destructive text-xs mt-1">{errors.phoneNumber.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium mb-1 block">Date of Birth</Label>
              <Input
                {...register("dob")}
                type="date"
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.dob && (
                <p className="text-destructive text-xs mt-1">{errors.dob.message}</p>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium mb-1 block">Gender</Label>
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

          <label className="flex items-center gap-3 p-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!isSuperAdminChecked}
              onChange={(e) => setValue("isSuperAdmin", e.target.checked)}
              className="w-4 h-4 accent-violet-600"
            />
            <div>
              <p className="text-sm font-medium text-violet-800 dark:text-violet-200 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Super Admin
              </p>
              <p className="text-xs text-violet-600 dark:text-violet-400">
                Can manage all admin users
              </p>
            </div>
          </label>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-10">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Savingâ€¦" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// â”€â”€â”€ Delete Confirm Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DeleteConfirmModal({
  name,
  userId,
  onClose,
  onConfirm,
}: {
  name: string;
  userId: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteAdmin = useAuthenticatedMutation(api.routes.admin.deleteAdminUser);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAdmin({ userId: userId as any });
      toast.success("Admin access removed");
      onConfirm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove admin");
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
            Remove all admin access from{" "}
            <span className="font-medium text-foreground">{name}</span>? Their
            account will remain but they won&apos;t be able to access the dashboard.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 h-10 flex items-center justify-center gap-2"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isDeleting ? "Removingâ€¦" : "Remove"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Filter Fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function AdminUsersPage({
  initialAdmins,
}: {
  initialAdmins?: AdminUser[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<any[]>([]);

  const currentPerms = useAuthenticatedQuery(api.routes.admin.getCurrentAdminPermissions, {});
  const isSuperAdmin = currentPerms?.isSuperAdmin ?? false;

  const liveAdmins = useAuthenticatedQuery(api.routes.admin.getAllAdminUsers, {
    search: globalFilter || undefined,
  }) as AdminUser[] | undefined;

  const admins = liveAdmins ?? (globalFilter ? undefined : initialAdmins);

  const columns = AdminColumns(
    isSuperAdmin,
    (userId, name) => setDeleteTarget({ id: userId, name }),
    (user) => setEditTarget(user),
  );

  return (
    <div>
      {showCreate && <CreateAdminModal onClose={() => setShowCreate(false)} />}
      {editTarget && (
        <EditAdminModal user={editTarget} onClose={() => setEditTarget(null)} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.name}
          userId={deleteTarget.id}
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
              : "Loadingâ€¦"}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Admin
          </Button>
        )}
      </div>

      {!isSuperAdmin && currentPerms !== undefined && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <Shield className="h-4 w-4 text-amber-500 shrink-0" />
          You have read-only access. Only Super Admins can add, edit, or remove admin users.
        </div>
      )}

      <div className="card-glass p-4">
        <DataTable
          columns={columns}
          data={admins ?? []}
          isLoading={admins === undefined}
          searchPlaceholder="Search adminsâ€¦"
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
