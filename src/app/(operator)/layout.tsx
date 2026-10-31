import { Role } from "@prisma/client";
import { createRoleLayout } from "@/components/layout/RoleLayout";

const OperatorLayout = createRoleLayout({
  allowedRoles: [Role.PEGAWAI, Role.SUPER_ADMIN],
  pageTitle: "Triase Ulasan Operator",
});

export default OperatorLayout;
