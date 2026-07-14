import { requireAdmin } from '@/lib/admin/guard'

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await requireAdmin()

  return children
}

