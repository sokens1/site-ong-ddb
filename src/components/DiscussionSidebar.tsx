import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Message {
    id: number;
    content: string;
    created_at: string;
    user_id: string;
    recipient_id?: string | null;
    is_read?: boolean;
    user_profiles?: {
        full_name: string;
        avatar_url: string;
    };
}

interface DiscussionSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const DiscussionSidebar: React.FC<DiscussionSidebarProps> = ({ isOpen, onClose, userId }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);
    const [recentConversations, setRecentConversations] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && userId) {
            fetchUsers();
            fetchRecentConversations();
        }
    }, [isOpen, userId]);

    useEffect(() => {
        setMessages([]); // Clear messages immediately when switching user
        if (isOpen && selectedUser && userId) {
            fetchMessages();

            const channel = supabase
                .channel(`discussion_${userId}_${selectedUser.id}`)
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'discussion_messages'
                }, async (payload) => {
                    if (
                        (payload.new.user_id === userId && payload.new.recipient_id === selectedUser.id) ||
                        (payload.new.user_id === selectedUser.id && payload.new.recipient_id === userId)
                    ) {
                        if (payload.new.user_id === userId) {
                            // C'est mon propre message, on peut l'ajouter sans fetcher le profil
                            const data: Message = {
                                ...(payload.new as any),
                                user_profiles: { full_name: 'Vous', avatar_url: '' }
                            };
                            setMessages(prev => {
                                const exists = prev.some(m => m.id === data.id || (m.content === data.content && m.user_id === data.user_id && Math.abs(new Date(m.created_at).getTime() - new Date(data.created_at).getTime()) < 2000));
                                if (exists) return prev.map(m => (m.content === data.content && m.user_id === data.user_id) ? data : m);
                                return [...prev, data];
                            });
                        } else {
                            // Message de l'autre, on récupère son profil
                            const { data } = await supabase
                                .from('discussion_messages')
                                .select('*, user_profiles:user_id(full_name, avatar_url)')
                                .eq('id', payload.new.id)
                                .single();

                            if (data) {
                                setMessages(prev => {
                                    const exists = prev.some(m => (m as any).id === data.id);
                                    if (exists) return prev;
                                    return [...prev, data as any];
                                });
                            }
                        }
                    }
                })
                .subscribe();

            return () => { supabase.removeChannel(channel); };
        }
    }, [isOpen, selectedUser]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const fetchRecentConversations = async () => {
        if (!userId) return;
        try {
            const { data: messages, error } = await supabase
                .from('discussion_messages')
                .select(`
                    id,
                    content,
                    created_at,
                    user_id,
                    recipient_id,
                    sender:user_id(id, full_name, avatar_url, email),
                    recipient:recipient_id(id, full_name, avatar_url, email)
                `)
                .or(`user_id.eq.${userId},recipient_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (error) {
                return;
            }

            if (messages) {
                const convos: any[] = [];
                const seenIds = new Set();

                // Fetch unread counts for EACH potential conversation
                const { data: unreadStats } = await supabase
                    .from('discussion_messages')
                    .select('user_id')
                    .eq('recipient_id', userId)
                    .eq('is_read', false);

                const unreadMap: Record<string, number> = {};
                unreadStats?.forEach(u => {
                    unreadMap[u.user_id] = (unreadMap[u.user_id] || 0) + 1;
                });

                messages.forEach(m => {
                    const sender = Array.isArray(m.sender) ? m.sender[0] : m.sender;
                    const recipient = Array.isArray(m.recipient) ? m.recipient[0] : m.recipient;
                    const otherUser = m.user_id === userId ? recipient : sender;

                    // Strict filtering in case DB joins are weird
                    if (otherUser && (otherUser as any).id !== userId && !seenIds.has((otherUser as any).id)) {
                        const otherId = (otherUser as any).id;
                        seenIds.add(otherId);
                        convos.push({
                            user: otherUser,
                            lastMessage: m,
                            unreadCount: unreadMap[otherId] || 0
                        });
                    }
                });
                setRecentConversations(convos);
            }
        } catch (err) {
            console.error('Unexpected error fetching recent convos:', err);
        }
    };

    const markAsRead = async (otherUserId: string) => {
        if (!userId || !otherUserId) return;
        try {
            await supabase
                .from('discussion_messages')
                .update({ is_read: true })
                .eq('recipient_id', userId)
                .eq('user_id', otherUserId)
                .eq('is_read', false);
        } catch (err) {
            // Quiet fail
        }
    };

    useEffect(() => {
        if (selectedUser) {
            markAsRead(selectedUser.id);
            // On peut aussi enlever localement les badges
            setRecentConversations(prev => prev.map(c =>
                c.user.id === selectedUser.id
                    ? { ...c, lastMessage: { ...c.lastMessage, is_read: true }, unreadCount: 0 }
                    : c
            ));
        }
    }, [selectedUser]);

    const fetchUsers = async () => {
        if (!userId) return;
        try {
            // Fetch all profiles but filter CURRENT user explicitly
            const { data, error } = await supabase
                .from('user_profiles')
                .select('id, full_name, role, avatar_url, email')

            if (error) {
                return;
            }

            // Post-fetch strict filtering to be 100% sure
            const filtered = (data || []).filter(u => String(u.id).toLowerCase() !== String(userId).toLowerCase());
            setUsers(filtered);
        } catch (err) {
            console.error('Unexpected error fetching users:', err);
        }
    };

    const fetchMessages = async () => {
        if (!selectedUser) return;
        const { data } = await supabase
            .from('discussion_messages')
            .select('*, user_profiles:user_id(full_name, avatar_url)')
            .or(`and(user_id.eq.${userId},recipient_id.eq.${selectedUser.id}),and(user_id.eq.${selectedUser.id},recipient_id.eq.${userId})`)
            .order('created_at', { ascending: true })
            .limit(50);

        setMessages(data || []);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || loading || !selectedUser) return;

        const messageText = newMessage.trim();
        setNewMessage('');

        // Optimistic Update
        const optimisticMsg: Message = {
            id: Date.now(), // Temporary ID
            content: messageText,
            user_id: userId,
            created_at: new Date().toISOString(),
            user_profiles: {
                full_name: 'Vous',
                avatar_url: ''
            }
        };
        setMessages(prev => [...prev, optimisticMsg]);

        setLoading(true);
        try {
            const { error } = await supabase
                .from('discussion_messages')
                .insert([{
                    content: messageText,
                    user_id: userId,
                    recipient_id: selectedUser.id
                }]);

            if (error) {
                // Remove optimistic message on error
                setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
                throw error;
            }

            // Note: The real-time subscription will replace/add the "real" message
        } catch (err: any) {
            // Error managed by optimistic UI logic
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
                    />

                    {/* Bottom Sheet - Slide from Bottom */}
                    <motion.div
                        drag="y"
                        dragConstraints={{ top: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(_e, info) => {
                            if (info.offset.y > 150) onClose();
                        }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-2xl bg-white shadow-2xl z-[70] flex flex-col rounded-t-3xl overflow-hidden border-t border-gray-100"
                        style={{ height: '85vh', maxHeight: '600px' }}
                    >
                        {/* Drag Handle */}
                        <div className="w-full flex justify-center py-2 bg-white">
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
                        </div>

                        {/* Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b bg-white">
                            <div className="flex items-center gap-3">
                                {selectedUser && (
                                    <button
                                        onClick={() => setSelectedUser(null)}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-green-600"
                                    >
                                        <i className="fas fa-chevron-left text-lg"></i>
                                    </button>
                                )}
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={22} className="text-green-600" />
                                    <h2 className="font-bold text-gray-800 text-lg">
                                        {selectedUser ? selectedUser.full_name : 'Discussions'}
                                    </h2>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                                <X size={24} />
                            </button>
                        </div>


                        {/* Content */}
                        {!selectedUser ? (
                            <div className="flex-1 overflow-y-auto bg-white p-6">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Membres disponibles</p>

                                <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide -mx-2 px-2 scroll-smooth">
                                    {users.length === 0 ? (
                                        <div className="w-full text-center py-8 text-gray-400 italic text-sm">
                                            Aucun autre membre connecté
                                        </div>
                                    ) : (
                                        users.map((u) => (
                                            <button
                                                key={u.id}
                                                onClick={() => setSelectedUser(u)}
                                                className="flex flex-col items-center gap-2 min-w-[80px] group transition-transform active:scale-95"
                                            >
                                                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-600 font-bold text-xl border-2 border-transparent group-hover:border-green-500 transition-all shadow-sm">
                                                    {u.full_name?.[0] || 'U'}
                                                </div>
                                                <span className="text-[11px] font-semibold text-gray-700 w-20 text-center truncate">
                                                    {u.full_name || 'Sans nom'}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-gray-100 my-6 -mx-6"></div>

                                {/* Recent Conversations Vertical List */}
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Conversations récentes</p>

                                {recentConversations.length === 0 ? (
                                    <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                        <p className="text-sm text-gray-400">Aucune conversation récente</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {recentConversations.map((conv) => (
                                            <button
                                                key={conv.user.id}
                                                onClick={() => setSelectedUser(conv.user)}
                                                className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-all group text-left border border-transparent hover:border-gray-100"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold shrink-0">
                                                    {conv.user.full_name?.[0] || 'U'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h3 className="font-bold text-gray-800 text-sm truncate">{conv.user.full_name || 'Sans nom'}</h3>
                                                        <span className="text-[10px] text-gray-400">
                                                            {new Date(conv.lastMessage.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <p className="text-xs text-gray-500 truncate pr-4 flex-1">
                                                            {conv.lastMessage.user_id === userId ? 'Vous: ' : ''}
                                                            {conv.lastMessage.content}
                                                        </p>
                                                        {conv.unreadCount && conv.unreadCount > 0 && (
                                                            <span className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                                                                {conv.unreadCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className={`w-1.5 h-1.5 rounded-full bg-green-500 transition-opacity ${conv.unreadCount && conv.unreadCount > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Messages Area */}
                                <div
                                    ref={scrollRef}
                                    className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f9fa]"
                                >
                                    {messages.length === 0 && (
                                        <div className="text-center py-10 bg-white rounded-2xl mx-10 border border-dashed border-gray-200">
                                            <p className="text-sm font-medium text-gray-500">Pas encore de messages.</p>
                                            <p className="text-xs text-gray-400">Envoyez le premier message !</p>
                                        </div>
                                    )}

                                    {messages.map((msg) => {
                                        const isMine = msg.user_id === userId;
                                        return (
                                            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                                <div className="max-w-[85%]">
                                                    <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${isMine
                                                        ? 'bg-green-600 text-white rounded-tr-none'
                                                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                                                        }`}>
                                                        {msg.content}
                                                        <div className={`text-[9px] mt-1 ${isMine ? 'text-green-100' : 'text-gray-400'}`}>
                                                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Input Area */}
                                <form onSubmit={handleSend} className="p-4 border-t bg-white">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Écrivez votre message..."
                                            className="flex-1 px-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!newMessage.trim() || loading}
                                            className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 disabled:opacity-50 transition-all active:scale-90"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </motion.div>
                </>
            )
            }
        </AnimatePresence >
    );
};

export default DiscussionSidebar;
