import { Role } from "@prisma/client";
import { createRoleLayout } from "@/components/layout/RoleLayout";

const AdminLayout = createRoleLayout({
  allowedRoles: [Role.SUPER_ADMIN],
  pageTitle: "Administrasi Sistem",
});

export default AdminLayout;
