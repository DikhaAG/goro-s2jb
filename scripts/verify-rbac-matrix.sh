#!/usr/bin/env bash
set -e

echo "================================================================="
echo "  🔒 GORO S2JB - Verifikasi Matriks Penetrasi RBAC Multi-Layer"
echo "  Pengujian 5 Lapisan Pertahanan: Edge Proxy, Layout, API, tRPC, UI"
echo "================================================================="
echo ""

npx vitest run tests/integration/routeProxyPenetration.test.ts \
               tests/integration/routeHandlersSecurity.test.ts \
               tests/integration/serverLayoutGuards.test.ts \
               tests/integration/trpcRbacFullMatrix.test.ts \
               tests/unit/navigationRbacFilter.test.ts

echo ""
echo "================================================================="
echo "  ✅ SELURUH 80 TITIK UJI PENETRASI RBAC KANONIKAL LULUS 100%!"
echo "================================================================="
