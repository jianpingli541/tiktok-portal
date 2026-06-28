import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useBillingReturn, useCurrentSubscription } from '@/hooks/useSubscriptions';
import { ApiError } from '@/lib/api/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BillingReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const navigate = useNavigate();
  const qc = useCurrentSubscription();
  const returnQuery = useBillingReturn(sessionId);

  // On paid, refresh the subscription cache so the rest of the app picks up
  // the new plan without a manual reload.
  useEffect(() => {
    if (returnQuery.data?.payment_status === 'paid') {
      qc.refetch();
    }
  }, [returnQuery.data, qc]);

  if (!sessionId) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Missing session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No checkout session id was provided.
            </p>
            <Button asChild className="w-full">
              <Link to="/billing">Back to billing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (returnQuery.isLoading) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Confirming your payment…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (returnQuery.isError) {
    const err = returnQuery.error;
    const expired = err instanceof ApiError && err.status === 404;
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>{expired ? 'Session expired' : 'Could not verify payment'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {expired
                ? 'Your checkout session has expired. Please choose a plan again.'
                : err instanceof ApiError
                  ? err.message
                  : 'Unexpected error verifying your payment.'}
            </p>
            <Button onClick={() => navigate('/billing', { replace: true })} className="w-full">
              Back to billing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = returnQuery.data?.payment_status;

  if (status === 'paid' || status === 'no_payment_required') {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Payment successful</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your plan has been updated. You can head back to your tasks.
            </p>
            <Button onClick={() => navigate('/tasks', { replace: true })} className="w-full">
              Go to tasks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // unpaid / requires_payment_method / etc.
  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment not completed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your payment was not completed. You can try again from the billing page.
          </p>
          <Button onClick={() => navigate('/billing', { replace: true })} className="w-full">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}