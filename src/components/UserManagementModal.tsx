import React, { useState, useEffect } from "react";
import { Plus, X, Pencil, Trash2, Loader2, Users, User, KeyRound, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

export function UserManagementModal({
  onClose,
  onUserDeleted,
  onUsersChange,
}: {
  onClose: () => void;
  onUserDeleted?: (deletedUsername: string) => void;
  onUsersChange?: () => void;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.error || "Failed to load users");
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setIsSubmitting(true);
    setError("");

    try {
      const url = editingId ? `/api/users/${editingId}` : "/api/users";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.success) {
        setUsername("");
        setPassword("");
        setEditingId(null);
        fetchUsers();
        if (onUsersChange) {
          onUsersChange();
        }
      } else {
        setError(data.error || "Failed to save user");
      }
    } catch (e) {
      setError("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    setUsername(user.username);
    setPassword(user.password);
    setError("");
  };

  const handleDelete = async (id: string, userUsername?: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
        const removed = data.username || userUsername;
        if (removed && onUserDeleted) {
          onUserDeleted(removed);
        }
        if (onUsersChange) {
          onUsersChange();
        }
      } else {
        setError(data.error || "Failed to delete user");
      }
    } catch (e) {
      setError("An error occurred");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-50/50 dark:bg-[#0B1120]/80 backdrop-blur-md overflow-hidden font-sans">
      
      {/* Modern Animated Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] rounded-full bg-blue-500/10 dark:bg-blue-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[35vw] h-[35vw] rounded-full bg-indigo-500/10 dark:bg-indigo-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMTQ4LCAxNjMsIDE4NCwgMC4xNSkiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        
        {/* Floating animated shapes */}
        <motion.div
          animate={{ y: [0, -30, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[15%] right-[15%] md:right-[25%] w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-400/20 to-purple-500/20 backdrop-blur-3xl border border-white/20 dark:border-white/10 rotate-12"
        />
        
        <motion.div
          animate={{ y: [0, 40, 0], rotate: [0, -15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-[15%] left-[15%] md:left-[25%] w-32 h-32 rounded-full bg-gradient-to-tr from-indigo-500/20 to-sky-400/20 backdrop-blur-3xl border border-white/20 dark:border-white/10"
        />
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-4xl relative z-10 flex max-h-[90vh]"
      >
        {/* Premium Glassmorphic Card */}
        <div className="bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-3xl shadow-2xl dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] p-6 sm:p-10 flex flex-col w-full">
          
          <div className="flex items-center justify-between mb-8 border-b border-slate-200/50 dark:border-white/10 pb-4">
            <motion.div variants={itemVariants} className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-30 dark:opacity-40 rounded-full" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-600/20 dark:to-indigo-600/20 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shadow-inner border border-white/50 dark:border-white/10">
                  <Users className="w-6 h-6 stroke-[1.5]" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Manage Users
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
                  Add or edit access to the business portal
                </p>
              </div>
            </motion.div>
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100/50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col md:flex-row gap-10">
            {/* Form Section */}
            <div className="w-full md:w-1/2">
              <motion.div variants={itemVariants}>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider">
                  {editingId ? "Edit User Details" : "Create New User"}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-1 uppercase tracking-wider">Username</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors">
                        <User className="h-5 w-5" />
                      </div>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="block w-full pl-11 pr-4 py-3.5 bg-white/50 dark:bg-[#0B1120]/50 border border-slate-200/80 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-all duration-300 font-medium"
                        placeholder="Enter username"
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 ml-1 uppercase tracking-wider">Password</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 dark:group-focus-within:text-blue-400 transition-colors">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="block w-full pl-11 pr-12 py-3.5 bg-white/50 dark:bg-[#0B1120]/50 border border-slate-200/80 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 transition-all duration-300 font-medium"
                        placeholder="••••••••"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        className="text-rose-500 dark:text-rose-400 text-sm font-semibold bg-rose-50/80 dark:bg-rose-500/10 border border-rose-200/80 dark:border-rose-500/20 rounded-xl p-3.5 text-center flex items-center justify-center gap-2"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="group relative flex-1 flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-white dark:focus:ring-offset-slate-900 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] hover:shadow-[0_12px_25px_-6px_rgba(37,99,235,0.6)] active:scale-[0.98] overflow-hidden"
                    >
                      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : editingId ? (
                        "Update User"
                      ) : (
                        "Add User"
                      )}
                    </button>
                    {editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setUsername("");
                          setPassword("");
                          setError("");
                        }}
                        className="px-5 py-3.5 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            </div>

            {/* List Section */}
            <div className="w-full md:w-1/2">
              <motion.div variants={itemVariants}>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-wider">
                  Existing Users
                </h3>
                {isLoading ? (
                  <div className="flex justify-center items-center h-40">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center bg-white/30 dark:bg-black/20 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                    <Users className="w-8 h-8 text-slate-400 mb-2 opacity-50" />
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      No extra users found.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 pr-2">
                    {users.map((user) => (
                      <div 
                        key={user.id} 
                        className="group flex items-center justify-between p-4 rounded-2xl bg-white/60 dark:bg-[#0B1120]/60 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all hover:border-blue-500/30 dark:hover:border-blue-500/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{user.username}</div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 tracking-wide flex items-center gap-1">
                              <KeyRound className="w-3 h-3" />
                              {/* Displaying masked password for security, or full depending on preference. The user asked for "eye button" on the main password input, not necessarily here, but showing it plain might be what they had before. Let's show it plain but slightly muted like before, since they asked for no functional changes to the list, just design. */}
                              <span className="font-mono">{user.password}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white/50 dark:bg-white/5"
                            title="Edit User"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.username)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/40 bg-white/50 dark:bg-white/5"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
