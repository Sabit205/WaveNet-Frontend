"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Phone, Video, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface CallLog {
    _id: string;
    callerId: string;
    receiverId: string;
    callType: 'audio' | 'video';
    callStatus: string;
    startTime: string;
    endTime?: string;
}

export default function CallHistoryPage() {
    const { userId, getToken } = useAuth();
    const [logs, setLogs] = useState<CallLog[]>([]);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!userId) return;
            try {
                const token = await getToken();
                const res = await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/api/calls/history/${userId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data);
                }
            } catch (err) {
                console.error("Failed to fetch history", err);
            }
        };

        fetchHistory();
    }, [userId, getToken]);

    return (
        <div className="container mx-auto p-4">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <h2 className="text-2xl font-bold">Call History</h2>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Calls</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Caller</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Duration</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">No call history found.</TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log._id}>
                                        <TableCell>
                                            {log.callType === 'video' ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                                        </TableCell>
                                        <TableCell>{log.callerId === userId ? 'You' : log.callerId}</TableCell>
                                        <TableCell>
                                            <span className={`capitalize ${log.callStatus === 'missed' ? 'text-red-500' :
                                                    log.callStatus === 'rejected' ? 'text-orange-500' : 'text-green-500'
                                                }`}>
                                                {log.callStatus}
                                            </span>
                                        </TableCell>
                                        <TableCell>{format(new Date(log.startTime), 'PP p')}</TableCell>
                                        <TableCell>
                                            {log.endTime ? (
                                                Math.round((new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000) + 's'
                                            ) : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
