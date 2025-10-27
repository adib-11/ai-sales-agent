'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageConnectionStatus } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

function ChatbotIntegrationContent() {
  const [status, setStatus] = useState<PageConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchStatus();

    // Handle OAuth callback results
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'true') {
      toast({
        title: 'Success!',
        description: 'Your Facebook Page has been connected successfully.',
      });
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard/chatbot');
    } else if (error) {
      let errorMessage = 'Failed to connect your Facebook Page.';
      switch (error) {
        case 'user_denied':
          errorMessage = 'You denied the permissions request.';
          break;
        case 'no_pages':
          errorMessage = 'No Facebook Pages found. Please create a Page first.';
          break;
        case 'oauth_failed':
          errorMessage = 'OAuth authentication failed. Please try again.';
          break;
        case 'unauthorized':
          errorMessage = 'You must be logged in to connect a Facebook Page.';
          break;
      }
      toast({
        title: 'Connection Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard/chatbot');
    }
  }, [searchParams, toast]);

  async function fetchStatus() {
    try {
      setLoading(true);
      const response = await fetch('/api/facebook/status');
      if (response.ok) {
        const data: PageConnectionStatus = await response.json();
        setStatus(data);
      } else {
        console.error('Failed to fetch status');
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      setDisconnecting(true);
      const response = await fetch('/api/facebook/disconnect', {
        method: 'DELETE',
      });

      if (response.ok || response.status === 204) {
        toast({
          title: 'Disconnected',
          description: 'Your Facebook Page has been disconnected.',
        });
        setStatus({ isConnected: false });
      } else {
        const data = await response.json();
        toast({
          title: 'Disconnect Failed',
          description: data.message || 'Failed to disconnect your Facebook Page.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while disconnecting.',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
      setShowDisconnectDialog(false);
    }
  }

  function handleConnect() {
    window.location.href = '/api/facebook/connect';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chatbot Integration</h1>
        <p className="text-gray-500 mt-2">
          Connect your Facebook Page to enable the AI chatbot for Messenger inquiries.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facebook Messenger</CardTitle>
          <CardDescription>
            Connect your Facebook Page to allow the AI chatbot to automatically respond to customer
            inquiries via Facebook Messenger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{status.pageName}</div>
                    <Badge variant="default" className="bg-green-600">Active</Badge>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Your Facebook Page is connected and the chatbot is active.
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowDisconnectDialog(true)}
                  disabled={disconnecting}
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    'Disconnect'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed p-8 text-center">
                <h3 className="text-lg font-medium">No Facebook Page Connected</h3>
                <p className="text-sm text-gray-500 mt-2 mb-4">
                  Connect your Facebook Page to enable the AI chatbot for Messenger.
                </p>
                <Button onClick={handleConnect}>
                  Connect Your Facebook Page
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Facebook Page?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect your Facebook Page? The chatbot will stop
              responding to Messenger inquiries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ChatbotIntegrationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <ChatbotIntegrationContent />
    </Suspense>
  );
}
