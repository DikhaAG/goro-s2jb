"use client";

import React from "react";
import { Up3GroupDaily } from "@/server/services/reportService";
import { Badge } from "@/components/ui/badge";

interface ReportTableDailyProps {
  groups: Up3GroupDaily[];
  grandTotal: {
    dailyTarget: number;
    dailyRealization: number;
    dailyPercentage: number;
    status: "TERCAPAI" | "TIDAK TERCAPAI";
  };
}

export function ReportTableDaily({ groups, grandTotal }: ReportTableDailyProps) {
  let counter = 1;

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#e2e8f0] bg-white shadow-xs">
      <table className="w-full text-xs text-left border-collapse font-sans">
        <thead>
          <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#475569] font-bold uppercase tracking-wider text-[11px]">
            <th className="py-3 px-3 text-center w-12 border-r border-[#e2e8f0]">NO</th>
            <th className="py-3 px-4 border-r border-[#e2e8f0]">NAMA ULP</th>
            <th className="py-3 px-4 text-right border-r border-[#e2e8f0] w-36">TARGET HARIAN</th>
            <th className="py-3 px-4 text-right border-r border-[#e2e8f0] w-36">REALISASI HARIAN</th>
            <th className="py-3 px-4 text-right border-r border-[#e2e8f0] w-28">% HARIAN</th>
            <th className="py-3 px-4 text-center w-36">KETERANGAN</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1f5f9]">
          {groups.map((group) => {
            return (
              <React.Fragment key={group.up3Id}>
                {/* UP3 Group Banner */}
                <tr className="bg-[#f1f5f9] font-bold text-[#006877]">
                  <td
                    colSpan={6}
                    className="py-2.5 px-4 font-mono tracking-wide text-xs border-y border-[#e2e8f0]"
                  >
                    🏢 {group.up3Name}
                  </td>
                </tr>

                {/* ULP Rows */}
                {group.ulps.map((ulp) => {
                  const isPass = ulp.status === "TERCAPAI";
                  return (
                    <tr
                      key={ulp.ulpId}
                      className="hover:bg-[#f8fafc] transition-colors text-[#334155]"
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-[#94a3b8] border-r border-[#f1f5f9]">
                        {counter++}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#0f172a] border-r border-[#f1f5f9]">
                        {ulp.ulpName}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-[#64748b] border-r border-[#f1f5f9]">
                        {ulp.dailyTarget.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-[#0f172a] border-r border-[#f1f5f9]">
                        {ulp.dailyRealization.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold border-r border-[#f1f5f9]">
                        <span className={isPass ? "text-[#15803d]" : "text-[#b45309]"}>
                          {ulp.dailyPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge
                          variant={isPass ? "success" : "warning"}
                          className="text-[10px] py-0 px-2 uppercase font-semibold"
                        >
                          {ulp.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}

                {/* UP3 Subtotal */}
                <tr className="bg-[#f8fafc] font-bold border-b border-[#cbd5e1] text-[#0f172a]">
                  <td className="border-r border-[#e2e8f0]"></td>
                  <td className="py-2.5 px-4 text-[#006877] border-r border-[#e2e8f0]">
                    SUBTOTAL {group.up3Name}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#64748b] border-r border-[#e2e8f0]">
                    {group.subtotal.dailyTarget.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#006877] font-bold border-r border-[#e2e8f0]">
                    {group.subtotal.dailyRealization.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#006877] font-bold border-r border-[#e2e8f0]">
                    {group.subtotal.dailyPercentage.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span
                      className={`text-[10px] font-bold ${
                        group.subtotal.status === "TERCAPAI" ? "text-[#15803d]" : "text-[#b45309]"
                      }`}
                    >
                      {group.subtotal.status}
                    </span>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}

          {/* Grand Total Row */}
          <tr className="bg-[#e7eeff] font-bold text-[#0f172a] border-t-2 border-[#00a2b9] text-xs">
            <td className="py-3 px-3 text-center border-r border-[#cbd5e1]"></td>
            <td className="py-3 px-4 text-[#006877] font-bold uppercase tracking-wider border-r border-[#cbd5e1]">
              TOTAL UID S2JB
            </td>
            <td className="py-3 px-4 text-right font-mono text-[#64748b] border-r border-[#cbd5e1]">
              {grandTotal.dailyTarget.toLocaleString("id-ID")}
            </td>
            <td className="py-3 px-4 text-right font-mono text-[#006877] font-bold text-sm border-r border-[#cbd5e1]">
              {grandTotal.dailyRealization.toLocaleString("id-ID")}
            </td>
            <td className="py-3 px-4 text-right font-mono text-[#006877] font-bold text-sm border-r border-[#cbd5e1]">
              {grandTotal.dailyPercentage.toFixed(1)}%
            </td>
            <td className="py-3 px-4 text-center">
              <Badge
                variant={grandTotal.status === "TERCAPAI" ? "success" : "warning"}
                className="text-xs font-bold"
              >
                {grandTotal.status}
              </Badge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
