import { Role } from "@prisma/client";
import { createRoleLayout } from "@/components/layout/RoleLayout";

const FieldLayout = createRoleLayout({
  allowedRoles: [Role.PETUGAS_LAPANGAN, Role.SUPER_ADMIN],
  pageTitle: "Entri Eviden",
});

export default FieldLayout;
