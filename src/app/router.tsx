import { createBrowserRouter } from 'react-router-dom';
import Layout from './Layout';
import RequireAuth from './RequireAuth';
import Landing from './(marketing)/Landing';
import Pricing from './(marketing)/Pricing';
import Login from './(auth)/Login';
import Register from './(auth)/Register';
import VerifyEmail from './(auth)/VerifyEmail';
import ForgotPassword from './(auth)/ForgotPassword';
import Account from './(account)/Account';
import Billing from './(account)/Billing';
import BillingReturn from './(account)/BillingReturn';
import Submit from './(workspace)/Submit';
import TaskList from './(workspace)/TaskList';
import TaskDetail from './(workspace)/TaskDetail';
import Privacy from './(legal)/Privacy';
import Terms from './(legal)/Terms';
import Refund from './(legal)/Refund';
import DataDeletion from './(legal)/DataDeletion';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      // Marketing routes (public)
      { path: '', element: <Landing /> },
      { path: 'pricing', element: <Pricing /> },
      // Legal routes (public, GDPR)
      { path: 'privacy', element: <Privacy /> },
      { path: 'terms', element: <Terms /> },
      { path: 'refund', element: <Refund /> },
      // Auth routes (public)
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'verify-email', element: <VerifyEmail /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      // Protected routes — RequireAuth is pure Outlet guard (no Layout),
      // Layout above renders exactly once around the matched child.
      {
        element: <RequireAuth />,
        children: [
          // (account) routes
          { path: 'account', element: <Account /> },
          { path: 'billing', element: <Billing /> },
          { path: 'billing/return', element: <BillingReturn /> },
          // (legal) gated routes
          { path: 'account/delete-data', element: <DataDeletion /> },
          // (workspace) routes
          { path: 'submit', element: <Submit /> },
          { path: 'tasks', element: <TaskList /> },
          { path: 'tasks/:id', element: <TaskDetail /> },
        ],
      },
      // 404 catch-all
      { path: '*', element: <div className="p-8">404</div> },
    ],
  },
]);
