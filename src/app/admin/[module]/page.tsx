'use client';

import AdminModuleWorkspace from '../AdminModuleWorkspace';

export default function AdminModulePage({ params }: { params: { module: string } }) {
  return <AdminModuleWorkspace module={params.module} />;
}
