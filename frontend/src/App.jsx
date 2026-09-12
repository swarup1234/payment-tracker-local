import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Customers from './pages/Customers.jsx'
import CustomerDetail from './pages/CustomerDetail.jsx'
import Transactions from './pages/Transactions.jsx'
import BulkCharge from './pages/BulkCharge.jsx'
import Services from './pages/Services.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="bulk-charge" element={<BulkCharge />} />
          <Route path="services" element={<Services />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
