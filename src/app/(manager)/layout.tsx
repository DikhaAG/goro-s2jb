import { Role } from "@prisma/client";
import { createRoleLayout } from "@/components/layout/RoleLayout";

const ManagerLayout = createRoleLayout({
  allowedRoles: [Role.MANAGER, Role.SUPER_ADMIN],
  pageTitle: "Laporan & Intelijen Manajer",
});

export default ManagerLayout;
