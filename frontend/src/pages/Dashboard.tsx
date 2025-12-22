import dashboardData from "@/app/dashboard/data.json"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"

export default function Dashboard() {
  return (
    <div className="@container/main flex flex-1 flex-col gap-4 py-4">
      <SectionCards />
      <div className="px-4 lg:px-6">
        <div className="grid gap-4 lg:grid-cols-7">
          <div className="lg:col-span-4">
            <ChartAreaInteractive />
          </div>
          <div className="lg:col-span-3">
            {/* Empty panel placeholder; keeps the dashboard-01 two-column balance */}
            <div className="h-full rounded-xl border border-dashed bg-muted/20" />
          </div>
        </div>
      </div>
      <DataTable data={dashboardData} />
    </div>
  )
}