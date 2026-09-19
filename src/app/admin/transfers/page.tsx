import AdminResourcePage from '../../../components/AdminResourcePage';

export default function Transfers() {
  return (
    <AdminResourcePage
      title="Transfers"
      resource="transfers"
      columns={['Reference', 'Amount', 'Currency', 'Status', 'SenderUserId', 'RecipientUserId', 'CreatedAt']}
    />
  );
}
