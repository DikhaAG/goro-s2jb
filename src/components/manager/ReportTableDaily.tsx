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
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-md">
      <table className="w-full text-xs text-left border-collapse font-sans">
        <thead>
          <tr className="bg-slate-950 border-b border-slate-800 text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
            <th className="py-3 px-3 text-center w-12 border-r border-slate-800/60">NO</th>
            <th className="py-3 px-4 border-r border-slate-800/60">NAMA ULP</th>
            <th className="py-3 px-4 text-right border-r border-slate-800/60 w-36">TARGET HARIAN</th>
            <th className="py-3 px-4 text-right border-r border-slate-800/60 w-36">REALISASI HARIAN</th>
            <th className="py-3 px-4 text-right border-r border-slate-800/60 w-28">% HARIAN</th>
            <th className="py-3 px-4 text-center w-36">KETERANGAN</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {groups.map((group) => {
            return (
              <React.Fragment key={group.up3Id}>
                {/* UP3 Group Banner */}
                <tr className="bg-slate-950/80 font-bold text-slate-200">
                  <td
                    colSpan={6}
                    className="py-2.5 px-4 text-cyan-400 font-mono tracking-wide text-xs border-y border-slate-800"
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
                      className="hover:bg-slate-850/60 transition-colors text-slate-300"
                    >
                      <td className="py-2 px-3 text-center font-mono text-slate-500 border-r border-slate-800/40">
                        {counter++}
                      </td>
                      <td className="py-2 px-4 font-medium text-slate-200 border-r border-slate-800/40">
                        {ulp.ulpName}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-slate-400 border-r border-slate-800/40">
                        {ulp.dailyTarget.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-semibold text-slate-100 border-r border-slate-800/40">
                        {ulp.dailyRealization.toLocaleString("id-ID")}
                      </td>
                      <td className="py-2 px-4 text-right font-mono font-bold border-r border-slate-800/40">
                        <span className={isPass ? "text-emerald-400" : "text-amber-400"}>
                          {ulp.dailyPercentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-4 text-center">
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
                <tr className="bg-slate-900 font-bold border-b-2 border-slate-800 text-slate-200">
                  <td className="border-r border-slate-800/60"></td>
                  <td className="py-2 px-4 text-slate-300 border-r border-slate-800/60">
                    SUBTOTAL {group.up3Name}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-slate-300 border-r border-slate-800/60">
                    {group.subtotal.dailyTarget.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-cyan-300 border-r border-slate-800/60">
                    {group.subtotal.dailyRealization.toLocaleString("id-ID")}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-cyan-300 border-r border-slate-800/60">
                    {group.subtotal.dailyPercentage.toFixed(1)}%
                  </td>
                  <td className="py-2 px-4 text-center">
                    <span
                      className={`text-[10px] font-bold ${
                        group.subtotal.status === "TERCAPAI" ? "text-emerald-400" : "text-amber-400"
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
          <tr className="bg-slate-950 font-black text-slate-100 border-t-2 border-cyan-500/50 text-xs">
            <td className="py-3 px-3 text-center border-r border-slate-800"></td>
            <td className="py-3 px-4 text-cyan-400 font-bold uppercase tracking-wider border-r border-slate-800">
              TOTAL UID S2JB
            </td>
            <td className="py-3 px-4 text-right font-mono border-r border-slate-800">
              {grandTotal.dailyTarget.toLocaleString("id-ID")}
            </td>
            <td className="py-3 px-4 text-right font-mono text-cyan-300 text-sm border-r border-slate-800">
              {grandTotal.dailyRealization.toLocaleString("id-ID")}
            </td>
            <td className="py-3 px-4 text-right font-mono text-cyan-300 text-sm border-r border-slate-800">
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
