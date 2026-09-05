"use client";

import * as React from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Editor } from "@/components/Editor";
import { CategorySelect } from "@/components/CategorySelect";
import { UserAssignSelect } from "@/components/UserAssignSelect";
import { StatusSelect } from "@/components/StatusSelect";
import { UserManagementModal } from "@/components/UserManagementModal";
import { 
  Plus, 
  Search, 
  FileText, 
  X, 
  Clock, 
  Trash2,
  Tag,
  Lock,
  Unlock,
  KeyRound,
  Download,
  Pin,
  Save,
  Copy,
  CheckSquare,
  Square,
  LogOut,
  MoreHorizontal,
  Users,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { logout } from "@/actions/auth";
import { 
  fetchNotesApi, 
  saveNoteApi, 
  deleteNoteApi, 
  unlockNoteApi,
  togglePinApi,
  fetchCategoriesApi,
  createCategoryApi
} from "@/lib/notesApi";

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  tags: string[];
  patientId?: string;
  isLocked?: boolean;
  pin?: string;
  isPinned?: boolean;
  categoryId?: string;
  assignedTo?: string[];
  createdBy?: string;
  isTrashed?: boolean;
  status?: string;
  comments?: {
    id: string;
    username: string;
    text: string;
    type?: string;
    mediaData?: string;
    createdAt: string;
  }[];
}

// Quick helper to strip HTML tags for card grid summaries safely on both SSR and CSR
function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatNoteDate(value: string) {
  if (!value || value === "Just now") return value || "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  if (hour < 21) return "Good Evening";
  return "Good Night";
}

export default function Home() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = React.useState<string>("");
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [showSearch, setShowSearch] = React.useState<boolean>(false);
  const [sidebarFilter, setSidebarFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("All");
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [isDraftDirty, setIsDraftDirty] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [syncError, setSyncError] = React.useState<string>("");
  const [syncInfo, setSyncInfo] = React.useState<{ database: string; noteCount: number; portal?: string; isAdmin?: boolean; username?: string } | null>(null);
  const [categories, setCategories] = React.useState<{id: string, name: string}[]>([]);
  const [usersList, setUsersList] = React.useState<{id: string, username: string}[]>([]);
  const [isAddingCategory, setIsAddingCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [isUserModalOpen, setIsUserModalOpen] = React.useState<boolean>(false);

  // Close menu on click outside
  React.useEffect(() => {
    const handleClick = () => setOpenMenuId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isStandalone, setIsStandalone] = React.useState<boolean>(false);
  const [isInstalled, setIsInstalled] = React.useState<boolean>(false);

  // Notepad PIN Lock Screen State
  const [pinModalOpen, setPinModalOpen] = React.useState<boolean>(false);
  const [pinTargetNoteId, setPinTargetNoteId] = React.useState<string>("");
  const [pinInputValue, setPinInputValue] = React.useState<string>("");
  const [pinError, setPinError] = React.useState<string>("");
  const [isVerifyingPin, setIsVerifyingPin] = React.useState<boolean>(false);

  // Notepad PIN Configuration Dialog Inside Editor
  const [lockSettingsOpen, setLockSettingsOpen] = React.useState<boolean>(false);
  const [newPinValue, setNewPinValue] = React.useState<string>("");
  const [lockSettingsError, setLockSettingsError] = React.useState<string>("");
  const [selectionMode, setSelectionMode] = React.useState<boolean>(false);

  // Chat Panel State
  const [showChatPanel, setShowChatPanel] = React.useState<boolean>(false);
  const [chatInput, setChatInput] = React.useState<string>("");
  const [isSendingComment, setIsSendingComment] = React.useState<boolean>(false);
  const [chatReadCounts, setChatReadCounts] = React.useState<Record<string, number>>({});
  const [isLoggingOut, setIsLoggingOut] = React.useState<boolean>(false);

  const handleLogout = React.useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    try {
      await logout();
    } catch {}
    window.location.href = "/login";
  }, [isLoggingOut]);

  
  // Media Chat State
  const [isRecording, setIsRecording] = React.useState<boolean>(false);
  const [recordingTime, setRecordingTime] = React.useState<number>(0);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const recordingTimerRef = React.useRef<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = React.useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = React.useState<{
    noteIds: string[];
    title: string;
    subtitle: string;
    fromEditor?: boolean;
  } | null>(null);
  const [isDeleting, setIsDeleting] = React.useState<boolean>(false);
  const pendingSwitchNoteIdRef = React.useRef<string | null>(null);

  const isEditingRef = React.useRef(false);
  const isDraftDirtyRef = React.useRef(false);
  const activeNoteIdRef = React.useRef("");
  const editorHistoryPushedRef = React.useRef(false);
  const skipPopStateCloseRef = React.useRef(false);
  const notesRef = React.useRef<Note[]>([]);

  React.useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);
  React.useEffect(() => { isDraftDirtyRef.current = isDraftDirty; }, [isDraftDirty]);
  React.useEffect(() => { activeNoteIdRef.current = activeNoteId; }, [activeNoteId]);
  React.useEffect(() => { notesRef.current = notes; }, [notes]);

  const closeEditorWithoutHistory = React.useCallback(() => {
    const editingId = activeNoteIdRef.current;
    setIsEditing(false);
    setIsDraftDirty(false);
    setLockSettingsOpen(false);
    if (editingId) {
      setNotes((prev) => {
        const note = prev.find((n) => n.id === editingId);
        if (!note?.pin) return prev;
        return prev.map((n) =>
          n.id === editingId ? { ...n, content: "", patientId: "" } : n
        );
      });
    }
  }, []);

  const closeEditor = React.useCallback(() => {
    closeEditorWithoutHistory();
    if (editorHistoryPushedRef.current) {
      skipPopStateCloseRef.current = true;
      editorHistoryPushedRef.current = false;
      window.history.back();
    }
  }, [closeEditorWithoutHistory]);

  const openEditor = React.useCallback((noteId: string) => {
    setActiveNoteId(noteId);
    setIsEditing(true);
    setShowChatPanel(true);
    if (!editorHistoryPushedRef.current) {
      window.history.pushState({ pronotesEditor: true, noteId }, "", `/?note=${noteId}`);
      editorHistoryPushedRef.current = true;
    } else {
      window.history.replaceState({ pronotesEditor: true, noteId }, "", `/?note=${noteId}`);
    }
  }, []);

  const applySavedNoteToState = React.useCallback((oldId: string, savedNote: Note) => {
    setNotes((prev) => {
      const local = prev.find((n) => n.id === oldId);
      const merged: Note = {
        ...savedNote,
        title: local?.title ?? savedNote.title,
        content: local?.content || savedNote.content,
        patientId: local?.patientId || savedNote.patientId,
        tags: local?.tags ?? savedNote.tags,
        pin: local?.pin ?? savedNote.pin,
        categoryId: local?.categoryId ?? savedNote.categoryId,
        isLocked: local?.isLocked ?? savedNote.isLocked,
        isPinned: local?.isPinned ?? savedNote.isPinned,
        assignedTo: local?.assignedTo ?? savedNote.assignedTo,
        createdBy: local?.createdBy ?? savedNote.createdBy,
        isTrashed: local?.isTrashed ?? savedNote.isTrashed,
        updatedAt: local?.updatedAt ?? savedNote.updatedAt,
      };
      return [merged, ...prev.filter((n) => n.id !== oldId && n.id !== merged.id)];
    });

    if (activeNoteIdRef.current === oldId) {
      setActiveNoteId(savedNote.id);
      if (editorHistoryPushedRef.current) {
        window.history.replaceState({ pronotesEditor: true, noteId: savedNote.id }, "", `/?note=${savedNote.id}`);
      }
    }
  }, []);

  const maskNoteContent = React.useCallback((noteId: string) => {
    setNotes((prev) => {
      const note = prev.find((n) => n.id === noteId);
      if (!note?.pin) return prev;
      return prev.map((n) =>
        n.id === noteId ? { ...n, content: "", patientId: "" } : n
      );
    });
  }, []);

  // Seed home history entry so browser back from editor returns home instead of exiting
  React.useEffect(() => {
    if (!window.history.state?.pronotesHome && !window.history.state?.pronotesEditor) {
      window.history.replaceState({ pronotesHome: true }, "", "/");
    }

    const onPopState = () => {
      if (skipPopStateCloseRef.current) {
        skipPopStateCloseRef.current = false;
        return;
      }
      if (isEditingRef.current) {
        editorHistoryPushedRef.current = false;
        closeEditorWithoutHistory();
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [closeEditorWithoutHistory]);

  // Register Service Worker & handle PWA install prompt
  React.useEffect(() => {
    // Check if app is already running in standalone mode (installed app window)
    const isStandaloneMode = 
      window.matchMedia("(display-mode: standalone)").matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // 1. Pick up prompt if already caught by early head script
    if ((window as any).__deferredPwaPrompt) {
      setDeferredPrompt((window as any).__deferredPwaPrompt);
    }

    const handlePromptReady = () => {
      if ((window as any).__deferredPwaPrompt) {
        setDeferredPrompt((window as any).__deferredPwaPrompt);
      }
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPwaPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      (window as any).__deferredPwaPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("pwa-prompt-ready", handlePromptReady);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("pwa-prompt-ready", handlePromptReady);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    const promptEvent = deferredPrompt || (typeof window !== "undefined" && (window as any).__deferredPwaPrompt);
    
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult && choiceResult.outcome === "accepted") {
          (window as any).__deferredPwaPrompt = null;
          setDeferredPrompt(null);
          setIsInstalled(true);
        }
      } catch (err) {
        console.error("PWA install prompt error:", err);
      }
    } else {
      const isStandaloneMode = 
        window.matchMedia("(display-mode: standalone)").matches || 
        (window.navigator as any).standalone === true;
        
      if (isStandaloneMode) {
        alert("ProNotes is already installed on your device.");
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
          alert("To install ProNotes on iOS:\n1. Tap the Share button in Safari\n2. Scroll down and tap 'Add to Home Screen'");
        } else {
          alert("To install ProNotes:\n1. Open your browser menu (⋮ or ⋯)\n2. Select 'Install app' or 'Add to Home screen'");
        }
      }
    }
  };


  const fetchIdRef = React.useRef(0);

  const reloadFromServer = React.useCallback(async () => {
    const [result, categoriesResult] = await Promise.all([
      fetchNotesApi(),
      fetchCategoriesApi()
    ]);

    if (!result.success) {
      setSyncError(result.error || "Could not load notes from database");
      console.error("Failed to load notes from DB:", result.error);
      return result;
    }

    if (categoriesResult.success) {
      setCategories(categoriesResult.categories);
    }

    setSyncError("");

    try {
      const infoRes = await fetch(`/api/sync-info?_=${Date.now()}`, { cache: "no-store" });
      const info = await infoRes.json();
      if (info.success) {
        setSyncInfo({ database: info.database, noteCount: info.noteCount, portal: info.portal, isAdmin: info.isAdmin, username: info.username });
        if (info.portal === 'business') {
          try {
            const usersRes = await fetch('/api/users');
            const usersData = await usersRes.json();
            if (usersData.success) setUsersList(usersData.users);
          } catch {}
        }
      }
    } catch {
      setSyncInfo({ database: "connected", noteCount: result.notes.length });
    }

    setNotes((prev) => {
      if (isEditingRef.current && activeNoteIdRef.current) {
        const editingId = activeNoteIdRef.current;
        const localDraft = prev.find((n) => n.id === editingId);
        if (!localDraft) {
          return result.notes;
        }

        const mergedFromServer = result.notes.map((serverNote) =>
          serverNote.id === editingId
            ? {
                ...serverNote,
                title: localDraft.title,
                content: localDraft.content,
                tags: localDraft.tags,
                patientId: localDraft.patientId,
                categoryId: localDraft.categoryId,
                pin: localDraft.pin,
                isPinned: localDraft.isPinned,
                assignedTo: localDraft.assignedTo,
                updatedAt: localDraft.updatedAt,
              }
            : serverNote
        );

        const editingNoteOnServer = result.notes.some((n) => n.id === editingId);
        if (!editingNoteOnServer) {
          return [localDraft, ...mergedFromServer];
        }

        return mergedFromServer;
      }

      return result.notes;
    });

    return result;
  }, []);

  // Poll for chat updates when chat panel is open
  React.useEffect(() => {
    if (!showChatPanel || !activeNoteId || syncInfo?.portal !== "business") return;
    const intervalId = setInterval(() => {
      reloadFromServer();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [showChatPanel, activeNoteId, syncInfo?.portal, reloadFromServer]);

  // Initialize from local storage on mount
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("pronotes_chat_reads");
      if (stored) {
        setChatReadCounts(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);


  // Always load fresh from MongoDB — no local cache
  React.useEffect(() => {
    const fetchId = ++fetchIdRef.current;

    async function loadNotes() {
      setIsLoading(true);
      try {
        if (fetchId !== fetchIdRef.current) return;
        const result = await reloadFromServer();
        if (result.success && result.notes.length > 0) {
          const urlParams = new URLSearchParams(window.location.search);
          const urlNoteId = urlParams.get("note");
          
          if (urlNoteId && result.notes.some(n => n.id === urlNoteId)) {
            setActiveNoteId(urlNoteId);
            setIsEditing(true);
            setShowChatPanel(true);
          } else {
            setActiveNoteId((prev) => prev || result.notes[0].id);
          }
        }
      } finally {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    }

    loadNotes();
  }, [reloadFromServer]);

  // Keep in sync: refresh every 10s + when tab becomes visible
  React.useEffect(() => {
    const refreshNotes = () => {
      if (document.visibilityState !== "visible") return;
      void reloadFromServer();
    };

    const interval = window.setInterval(refreshNotes, 10000);
    document.addEventListener("visibilitychange", refreshNotes);
    window.addEventListener("focus", refreshNotes);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshNotes);
      window.removeEventListener("focus", refreshNotes);
    };
  }, [reloadFromServer]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  // Update when chat panel is open
  React.useEffect(() => {
    if (showChatPanel && activeNoteId && activeNote) {
      const count = activeNote.comments?.length || 0;
      setChatReadCounts((prev) => {
        if (prev[activeNoteId] === count) return prev;
        const next = { ...prev, [activeNoteId]: count };
        try {
          localStorage.setItem("pronotes_chat_reads", JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }
  }, [showChatPanel, activeNoteId, activeNote?.comments?.length]);

  // Debounced Autosave
  React.useEffect(() => {
    if (!isDraftDirty || !activeNote) return;

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const response = await saveNoteApi(activeNote.id, {
          title: activeNote.title,
          content: activeNote.content,
          tags: activeNote.tags,
          patientId: activeNote.patientId,
          categoryId: activeNote.categoryId,
          pin: activeNote.pin || "",
          isPinned: activeNote.isPinned ?? false,
          assignedTo: activeNote.assignedTo || [],
          status: activeNote.status || "Pending",
        });

        if (response.success && response.note) {
          setSaveStatus("saved");
          setIsDraftDirty(false);
          applySavedNoteToState(activeNote.id, response.note);
          await reloadFromServer();
          setTimeout(() => setSaveStatus("idle"), 1500);
        }
      } catch (error) {
        console.error("Autosave error:", error);
        setSaveStatus("idle");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeNote?.title, activeNote?.content, activeNote?.patientId, activeNote?.categoryId, activeNote?.tags, activeNote?.pin, activeNote?.isPinned, isDraftDirty, activeNoteId, reloadFromServer, applySavedNoteToState]);

  // Handle Note Clicks & Lock Prompt Check
  const handleNoteCardClick = (note: Note) => {
    if (selectionMode) {
      toggleNoteSelection(note.id);
      return;
    }

    if (note.pin && !note.content) {
      pendingSwitchNoteIdRef.current = null;
      setPinTargetNoteId(note.id);
      setPinInputValue("");
      setPinError("");
      setPinModalOpen(true);
    } else {
      openEditor(note.id);
    }
  };

  const closePinModal = React.useCallback(() => {
    pendingSwitchNoteIdRef.current = null;
    setPinModalOpen(false);
    setPinInputValue("");
    setPinError("");
  }, []);

  // Lock Verification Digit Inputs (Screen / Keyboard)
  const handlePinDigitPress = async (digit: string) => {
    if (pinInputValue.length >= 4) return;
    const nextVal = pinInputValue + digit;
    setPinInputValue(nextVal);

    if (nextVal.length === 4) {
      setIsVerifyingPin(true);
      setPinError("");
      try {
        const response = await unlockNoteApi(pinTargetNoteId, nextVal);
        if (response.success && response.note) {
          const unlocked = response.note;
          setNotes(prev =>
            prev.map(note =>
              note.id === pinTargetNoteId
                ? {
                    ...note,
                    content: unlocked.content,
                    patientId: unlocked.patientId,
                    pin: unlocked.pin,
                    isLocked: true
                  }
                : note
            )
          );
          setPinModalOpen(false);
          setPinInputValue("");
          const pendingId = pendingSwitchNoteIdRef.current;
          pendingSwitchNoteIdRef.current = null;
          const targetId = pendingId || pinTargetNoteId;
          openEditor(targetId);
        } else {
          setPinError(response.error || "Incorrect PIN");
          setPinInputValue("");
        }
      } catch (err) {
        console.error("PIN check failed:", err);
        setPinError("Connection Error");
        setPinInputValue("");
      } finally {
        setIsVerifyingPin(false);
      }
    }
  };

  // Keyboard PIN Inputs
  React.useEffect(() => {
    if (!pinModalOpen) return;
    const handlePhysicalKeys = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handlePinDigitPress(e.key);
      } else if (e.key === "Backspace") {
        setPinInputValue(prev => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        closePinModal();
      }
    };
    window.addEventListener("keydown", handlePhysicalKeys);
    return () => window.removeEventListener("keydown", handlePhysicalKeys);
  }, [pinModalOpen, pinInputValue, pinTargetNoteId]);

  // Handler for note content editing (TipTap update)
  const handleContentChange = (content: string) => {
    if (!activeNote) return;
    const isEmptyHtml = !content || content === "<p></p>" || content === "<p><br></p>" || content === "<p><br class=\"ProseMirror-trailingBreak\"></p>";
    if (isEmptyHtml && !activeNote.content) return;
    setNotes(prev =>
      prev.map(note =>
        note.id === activeNoteId
          ? { ...note, content, updatedAt: "Just now" }
          : note
      )
    );
    setIsDraftDirty(true);
  };

  // Handler for note title editing
  const handleTitleChange = (title: string) => {
    if (!activeNote) return;
    setNotes(prev =>
      prev.map(note =>
        note.id === activeNoteId
          ? { ...note, title, updatedAt: "Just now" }
          : note
      )
    );
    setIsDraftDirty(true);
  };

  // Handler for note patientId editing
  const handlePatientIdChange = (patientId: string) => {
    if (!activeNote) return;
    setNotes(prev =>
      prev.map(note =>
        note.id === activeNoteId
          ? { ...note, patientId, updatedAt: "Just now" }
          : note
      )
    );
    setIsDraftDirty(true);
  };

  const handleCategoryIdChange = (categoryId: string) => {
    if (!activeNote) return;
    setNotes(prev =>
      prev.map(note =>
        note.id === activeNoteId
          ? { ...note, categoryId, updatedAt: "Just now" }
          : note
      )
    );
    setIsDraftDirty(true);
  };

  const handleAssignedToChange = (assignedTo: string[]) => {
    if (!activeNote) return;
    setNotes(prev =>
      prev.map(note =>
        note.id === activeNoteId
          ? { ...note, assignedTo, updatedAt: "Just now" }
          : note
      )
    );
    setIsDraftDirty(true);
  };

  const handleStatusChange = (status: string) => {
    if (!activeNote) return;
    setNotes(prev =>
      prev.map(note =>
        note.id === activeNoteId
          ? { ...note, status, updatedAt: "Just now" }
          : note
      )
    );
    setIsDraftDirty(true);
  };

  // Save note immediately (manual save)
  const handleSave = async () => {
    if (!activeNote) return;
    setSaveStatus("saving");
    try {
      const response = await saveNoteApi(activeNote.id, {
        title: activeNote.title,
        content: activeNote.content,
        tags: activeNote.tags,
        patientId: activeNote.patientId,
        categoryId: activeNote.categoryId,
        pin: activeNote.pin || "",
        isPinned: activeNote.isPinned ?? false,
        assignedTo: activeNote.assignedTo || [],
        status: activeNote.status || "Pending",
      });

      if (response.success && response.note) {
        setSaveStatus("saved");
        setIsDraftDirty(false);
        applySavedNoteToState(activeNote.id, response.note);
        await reloadFromServer();
        setTimeout(() => setSaveStatus("idle"), 1500);
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus("idle");
    }
  };

  const submitMediaComment = async (text: string, type: string = 'text', mediaData?: string) => {
    if (!activeNote || (type === 'text' && !text.trim())) return;
    setIsSendingComment(true);
    try {
      const tempComment = {
        id: "temp-" + Date.now(),
        username: syncInfo?.username || "You",
        text: type === 'text' ? text.trim() : text,
        type,
        mediaData,
        createdAt: new Date().toISOString()
      };
      
      setNotes(prev =>
        prev.map(note =>
          note.id === activeNoteId
            ? { ...note, comments: [...(note.comments || []), tempComment] }
            : note
        )
      );
      
      if (type === 'text') setChatInput("");
      
      const { addCommentApi } = await import("@/lib/notesApi");
      const res = await addCommentApi(activeNote.id, text, type, mediaData);
      if (res.success && res.comment) {
        await reloadFromServer();
      }
    } catch (err) {
      console.error("Failed to send comment:", err);
    } finally {
      setIsSendingComment(false);
    }
  };

  const handleSendComment = () => {
    submitMediaComment(chatInput, 'text');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64String = canvas.toDataURL('image/jpeg', 0.7);
        submitMediaComment('Image', 'image', base64String);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          submitMediaComment('Voice Note', 'audio', base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 59) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (err) {
      console.error("Microphone access denied or not available", err);
      alert("Microphone access is required to send voice notes.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const handleCreateNote = () => {
    const tempId = "temp-" + Date.now();
    const defaultCategoryId = ["all", "pinned", "locked", "trash", "general"].includes(sidebarFilter) ? "general" : sidebarFilter;
    const newNote: Note = {
      id: tempId,
      title: "New Note",
      content: "",
      updatedAt: "Just now",
      tags: [],
      patientId: "",
      categoryId: defaultCategoryId,
      isLocked: false,
      pin: "",
      status: "Pending"
    };
    setNotes(prev => [newNote, ...prev]);
    openEditor(tempId);
  };

  // Securely lock note / config PIN dialog
  const handleApplyLock = async () => {
    if (!/^\d{4}$/.test(newPinValue)) {
      setLockSettingsError("PIN must be exactly 4 digits");
      return;
    }
    setSaveStatus("saving");
    try {
      const response = await saveNoteApi(activeNoteId, {
        title: activeNote?.title || "",
        content: activeNote?.content || "",
        tags: activeNote?.tags || [],
        patientId: activeNote?.patientId || "",
        pin: newPinValue,
        isPinned: activeNote?.isPinned ?? false,
        status: activeNote?.status || "Pending",
      });
      if (response.success && response.note) {
        applySavedNoteToState(activeNoteId, response.note);
        setSaveStatus("saved");
        setIsDraftDirty(false);
        await reloadFromServer();
        setTimeout(() => setSaveStatus("idle"), 1500);
      }
    } catch (err) {
      console.error("Failed to apply lock:", err);
    }
    setLockSettingsOpen(false);
    setNewPinValue("");
  };

  const handleRemoveLock = async () => {
    setSaveStatus("saving");
    try {
      const response = await saveNoteApi(activeNoteId, {
        title: activeNote?.title || "",
        content: activeNote?.content || "",
        tags: activeNote?.tags || [],
        patientId: activeNote?.patientId || "",
        pin: "",
        isPinned: activeNote?.isPinned ?? false,
        status: activeNote?.status || "Pending",
      });
      if (response.success && response.note) {
        applySavedNoteToState(activeNoteId, response.note);
        setSaveStatus("saved");
        setIsDraftDirty(false);
        await reloadFromServer();
        setTimeout(() => setSaveStatus("idle"), 1500);
      }
    } catch (err) {
      console.error("Failed to remove lock:", err);
    }
    setLockSettingsOpen(false);
    setNewPinValue("");
  };

  const saveActiveNoteIfDirty = React.useCallback(async () => {
    if (!isDraftDirtyRef.current || !activeNoteIdRef.current) return;
    const note = notesRef.current.find((n) => n.id === activeNoteIdRef.current);
    if (!note) return;
    try {
      const response = await saveNoteApi(note.id, {
        title: note.title,
        content: note.content,
        tags: note.tags,
        patientId: note.patientId,
        pin: note.pin || "",
        isPinned: note.isPinned ?? false,
        status: note.status || "Pending",
      });
      if (response.success && response.note) {
        setIsDraftDirty(false);
        applySavedNoteToState(note.id, response.note);
      }
    } catch (err) {
      console.error("Failed to save before switch:", err);
    }
  }, [applySavedNoteToState]);

  const switchToNoteInEditor = React.useCallback(async (note: Note) => {
    if (note.id === activeNoteIdRef.current) return;

    await saveActiveNoteIfDirty();
    maskNoteContent(activeNoteIdRef.current);

    const needsPin = !!note.pin && !note.content;
    if (needsPin) {
      pendingSwitchNoteIdRef.current = note.id;
      setPinTargetNoteId(note.id);
      setPinInputValue("");
      setPinError("");
      setPinModalOpen(true);
      return;
    }

    openEditor(note.id);
  }, [saveActiveNoteIfDirty, maskNoteContent, openEditor]);

  const openDeleteDialog = (
    noteIds: string[],
    options: { title: string; subtitle: string; fromEditor?: boolean }
  ) => {
    setDeleteDialog({ noteIds, ...options });
  };

  const performDelete = async () => {
    if (!deleteDialog) return;

    const { noteIds, fromEditor } = deleteDialog;
    setIsDeleting(true);

    try {
      const wasActive = noteIds.includes(activeNoteIdRef.current);

      if (fromEditor && noteIds.length === 1) {
        const currentId = noteIds[0];
        const currentIndex = notesRef.current.findIndex((n) => n.id === currentId);
        const updatedNotes = notesRef.current.filter((n) => n.id !== currentId);

        if (updatedNotes.length === 0) {
          const fallbackNote: Note = {
            id: "temp-" + Date.now(),
            title: "Untitled Note",
            content: "",
            updatedAt: "Just now",
            tags: ["General"],
            patientId: "",
            isLocked: false,
            pin: "",
          };
          setNotes([fallbackNote]);
          setActiveNoteId(fallbackNote.id);
        } else {
          setNotes(updatedNotes);
          const nextIndex = Math.max(0, currentIndex - 1);
          setActiveNoteId(updatedNotes[nextIndex].id);
        }
      } else {
        setNotes((prev) => prev.filter((n) => !noteIds.includes(n.id)));
      }

      setSelectedNoteIds((prev) => {
        const next = new Set(prev);
        noteIds.forEach((id) => next.delete(id));
        return next;
      });
      setSelectionMode(false);

      if (wasActive) {
        closeEditorWithoutHistory();
        if (editorHistoryPushedRef.current) {
          editorHistoryPushedRef.current = false;
          window.history.replaceState({ pronotesHome: true }, "", "/");
        }
      }

      await Promise.all(
        noteIds
          .filter((id) => !id.startsWith("temp-"))
          .map((id) => deleteNoteApi(id))
      );
      await reloadFromServer();
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setIsDeleting(false);
      setDeleteDialog(null);
    }
  };

  const handleDeleteCard = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    openDeleteDialog([note.id], {
      title: note.isTrashed ? "Delete this note permanently?" : "Move to trash?",
      subtitle: note.isTrashed 
        ? `"${note.title || "Untitled Note"}" will be permanently removed. This cannot be undone.`
        : `"${note.title || "Untitled Note"}" will be moved to the trash.`,
    });
  };

  const requestEditorDelete = () => {
    if (!activeNote) return;
    openDeleteDialog([activeNote.id], {
      title: activeNote.isTrashed ? "Delete this note permanently?" : "Move to trash?",
      subtitle: activeNote.isTrashed 
        ? `"${activeNote.title || "Untitled Note"}" will be permanently removed. This cannot be undone.`
        : `"${activeNote.title || "Untitled Note"}" will be moved to the trash.`,
      fromEditor: true,
    });
  };

  const handleDuplicateNote = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();

    if (note.isLocked && !note.content) {
      alert("Unlock this note first to duplicate its content.");
      return;
    }

    const tempId = "temp-" + Date.now();
    const duplicate: Note = {
      id: tempId,
      title: `${note.title || "Untitled Note"} (Copy)`,
      content: note.content || "",
      updatedAt: "Just now",
      tags: [...(note.tags || [])],
      patientId: note.patientId || "",
      isLocked: false,
      pin: "",
      isPinned: false,
      status: note.status || "Pending",
    };

    setNotes((prev) => [duplicate, ...prev]);

    try {
      const response = await saveNoteApi(tempId, {
        title: duplicate.title,
        content: duplicate.content,
        tags: duplicate.tags,
        patientId: duplicate.patientId,
        pin: "",
        isPinned: false,
        status: duplicate.status,
      });
      if (response.success && response.note) {
        applySavedNoteToState(tempId, response.note);
        await reloadFromServer();
      }
    } catch (err) {
      console.error("Failed to duplicate note:", err);
    }
  };

  const toggleNoteSelection = (noteId: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedNoteIds.size === 0) return;
    const count = selectedNoteIds.size;
    const isTrashView = sidebarFilter === "trash";
    openDeleteDialog([...selectedNoteIds], {
      title: isTrashView ? `Delete ${count} note${count > 1 ? "s" : ""} permanently?` : `Move ${count} note${count > 1 ? "s" : ""} to trash?`,
      subtitle: isTrashView 
        ? `${count} selected note${count > 1 ? "s" : ""} will be permanently removed. This cannot be undone.`
        : `${count} selected note${count > 1 ? "s" : ""} will be moved to the trash.`,
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedNoteIds(new Set());
  };

  // Filter notes based on query
  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (note.patientId && note.patientId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Toggle Pinned Status immediately
  const handleTogglePin = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();

    if (!/^[0-9a-fA-F]{24}$/.test(note.id)) {
      alert("Please save the note first, then pin it.");
      return;
    }

    const targetState = !note.isPinned;
    const result = await togglePinApi(note.id, targetState);

    if (!result.success) {
      console.error("Failed to toggle pin:", result.error);
      alert(result.error || "Could not update pin. Please try again.");
    }

    await reloadFromServer();
  };

  // Sort notes: pinned first, then preserve server order
  const sortedNotes = React.useMemo(() => {
    let baseNotes = [...filteredNotes];
    
    // Handle trash filter specifically
    if (sidebarFilter === "trash") {
      baseNotes = baseNotes.filter(n => n.isTrashed);
    } else {
      // For all other filters, hide trashed notes
      baseNotes = baseNotes.filter(n => !n.isTrashed);
      
      if (sidebarFilter === "pinned") {
        baseNotes = baseNotes.filter(n => n.isPinned);
      } else if (sidebarFilter === "locked") {
        baseNotes = baseNotes.filter(n => n.pin);
      } else if (sidebarFilter === "general") {
        baseNotes = baseNotes.filter(n => !n.categoryId || n.categoryId === "general");
      } else if (sidebarFilter !== "all") {
        baseNotes = baseNotes.filter(n => n.categoryId === sidebarFilter);
      }
    }

    if (syncInfo?.portal === "business" && statusFilter !== "All") {
      baseNotes = baseNotes.filter(n => (n.status || "Pending") === statusFilter);
    }

    return baseNotes.sort((a, b) => {
      const pinA = a.isPinned ? 1 : 0;
      const pinB = b.isPinned ? 1 : 0;
      return pinB - pinA;
    });
  }, [filteredNotes, sidebarFilter]);

  const navLinks = [
    { id: "all", label: "All Notes", icon: FileText },
    { id: "pinned", label: "Pinned", icon: Pin },
    { id: "locked", label: "Locked", icon: Lock },
    { id: "trash", label: "Trash", icon: Trash2 },
  ];

  const renderNoteCard = (note: Note) => (
                  <motion.div
                    key={note.id}
                    onClick={() => handleNoteCardClick(note)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleNoteCardClick(note);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -15, transition: { duration: 0.15 } }}
                    whileHover={{ 
                      y: -4, 
                      boxShadow: "0 15px 30px -10px rgba(59, 130, 246, 0.15)",
                      borderColor: "rgba(59, 130, 246, 0.3)"
                    }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className={`w-full text-left p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0F172A] border flex flex-col gap-3 sm:gap-4 transition-all duration-300 cursor-pointer shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] dark:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] relative group focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      selectedNoteIds.has(note.id)
                        ? "border-blue-400 dark:border-blue-500/50 ring-2 ring-blue-400/30"
                        : "border-slate-100 dark:border-white/5"
                    }`}
                  >
                    {/* Decorative faint glow */}
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-600/5 to-indigo-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    {selectionMode && (
                      <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleNoteSelection(note.id)}
                          className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${
                            selectedNoteIds.has(note.id)
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/80"
                          }`}
                          aria-label={selectedNoteIds.has(note.id) ? "Deselect note" : "Select note"}
                        >
                          {selectedNoteIds.has(note.id) && <CheckSquare className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5 relative z-10 w-full">
                      <div className="flex items-start justify-between w-full">
                        <span className="font-bold text-sm text-slate-800 dark:text-white leading-snug line-clamp-1 flex items-center gap-2 min-w-0 pr-2">
                          <button
                            onClick={(e) => handleTogglePin(e, note)}
                            className={`transition-colors ${
                              note.isPinned 
                                ? "text-blue-600 dark:text-[#3B82F6]" 
                                : "text-slate-300 dark:text-slate-600 hover:text-slate-500"
                            }`}
                            title={note.isPinned ? "Unpin note from top" : "Pin note to top"}
                          >
                            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? "fill-current" : ""}`} />
                          </button>
                          <span className="truncate">{note.title || "Untitled Note"}</span>
                        </span>
                        
                        {!selectionMode && (
                          <div className="relative flex items-center gap-0.5 shrink-0 opacity-40 hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                e.nativeEvent.stopImmediatePropagation();
                                setOpenMenuId(openMenuId === note.id ? null : note.id);
                              }}
                              className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <AnimatePresence>
                              {openMenuId === note.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                  transition={{ duration: 0.15 }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute right-0 top-full mt-1.5 w-32 bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-white/10 rounded-xl shadow-xl shadow-slate-200/40 dark:shadow-black/40 z-50 overflow-hidden flex flex-col py-1"
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTogglePin(e, note);
                                      setOpenMenuId(null);
                                    }}
                                    className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-2 transition-colors w-full text-left"
                                  >
                                    <Pin className="w-3.5 h-3.5" />
                                    {note.isPinned ? "Unpin Note" : "Pin Note"}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteDialog({
                                        noteIds: [note.id],
                                        title: note.isTrashed ? "Delete permanently?" : "Move to trash?",
                                        subtitle: note.isTrashed 
                                          ? "Are you sure you want to permanently delete this note? This action cannot be undone."
                                          : "This note will be moved to the trash."
                                      });
                                      setOpenMenuId(null);
                                    }}
                                    className="px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2 transition-colors w-full text-left"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {note.isTrashed ? "Delete Permanently" : "Move to Trash"}
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-450 whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatNoteDate(note.updatedAt)}
                        </span>
                        {note.createdBy && syncInfo?.portal === 'business' && (
                          <span className="text-[10px] text-indigo-500/80 dark:text-indigo-400/80 whitespace-nowrap font-medium">
                            By {note.createdBy}
                          </span>
                        )}
                      </div>
                    </div>

                    {note.isLocked && !note.content ? (
                      <div className="flex items-center gap-2 text-amber-500/80 dark:text-amber-500/70 text-xs font-semibold py-1">
                        <span className="text-amber-500 font-bold">Notepad PIN Protected</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed relative z-10 font-medium">
                        {stripHtml(note.content) || "Empty note content..."}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-auto pt-2 relative z-10">
                      {note.assignedTo && note.assignedTo.map((u, idx) => (
                        <span key={`assign-${idx}`} className="text-[9px] font-bold px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5" title="Assigned User">
                          <Users className="w-2.5 h-2.5" />
                          {u}
                        </span>
                      ))}
                      {note.tags && note.tags.map((t, idx) => (
                        <span key={idx} className="text-[9px] font-bold px-2 py-1 rounded-md bg-blue-50/50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Tag className="w-2.5 h-2.5" />
                          {t}
                        </span>
                      ))}
                      {syncInfo?.portal === 'business' && note.status && (
                        <span className={`text-[9px] font-bold px-2 py-1 rounded-md flex items-center gap-1.5 ${
                          note.status === 'Done' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          note.status === 'In Review' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {note.status}
                        </span>
                      )}
                      {!note.isLocked && note.patientId && (
                        <span className="text-[9px] font-mono font-bold px-2 py-1 rounded-md bg-blue-50 dark:bg-[#3B82F6]/10 text-blue-600 dark:text-[#3B82F6]">
                          {note.patientId}
                        </span>
                      )}
                      {note.isLocked && (
                        <span className="text-[9px] font-bold px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                          <Lock className="w-2.5 h-2.5" />
                          Locked
                        </span>
                      )}
                    </div>
                  </motion.div>
  );

  return (
    <div className="h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex overflow-hidden transition-colors duration-500 font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200/60 dark:border-white/10 flex flex-col justify-between shrink-0 bg-white/50 dark:bg-[#0F172A]/50 backdrop-blur-xl hidden md:flex z-20">
        <div className="flex flex-col">
          {/* Logo Area */}
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <FileText className="w-4.5 h-4.5 text-white stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white leading-none truncate max-w-[150px]">
                {syncInfo?.portal === 'business' ? (syncInfo.username || 'Notebook') : 'ProNotes'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold mt-1 capitalize">{syncInfo?.portal === 'business' ? 'Business Workspace' : 'Personal Workspace'}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-4 mt-2 flex flex-col gap-1 relative" onMouseLeave={() => {}}>
            {navLinks.map((item) => {
              const active = sidebarFilter === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSidebarFilter(item.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer relative z-10 group ${
                    active ? "text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebarActiveBg"
                      className="absolute inset-0 bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 -z-10"
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    />
                  )}
                  <Icon className={`w-4 h-4 transition-transform ${active ? "scale-110" : "group-hover:scale-110"}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="my-5 border-t border-slate-200/60 dark:border-white/10 mx-4" />

          {/* Categories */}
          <div className="px-4">
            <div className="flex items-center justify-between px-2 mb-2 group">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest transition-colors group-hover:text-slate-500 dark:group-hover:text-slate-300">Categories</span>
              <button onClick={() => setIsAddingCategory(true)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <AnimatePresence>
              {isAddingCategory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-2">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Category name"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && newCategoryName.trim()) {
                          const res = await createCategoryApi(newCategoryName.trim());
                          if (res.success && res.category) {
                            setCategories(prev => [...prev, res.category!]);
                            setNewCategoryName("");
                            setIsAddingCategory(false);
                          }
                        } else if (e.key === 'Escape') {
                          setIsAddingCategory(false);
                          setNewCategoryName("");
                        }
                      }}
                      className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto editor-scroll-body">
              <div 
                onClick={() => setSidebarFilter("general")}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer group ${sidebarFilter === "general" ? "bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300"}`}
              >
                <span className="group-hover:translate-x-1 transition-transform">General</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${sidebarFilter === "general" ? "bg-white dark:bg-[#0B1120] text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-500/20" : "bg-slate-200/50 dark:bg-white/10 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 dark:group-hover:text-blue-400"}`}>
                  {notes.filter(n => !n.categoryId || n.categoryId === "general").length}
                </span>
              </div>
              
              {categories.map(cat => (
                <div 
                  key={cat.id}
                  onClick={() => setSidebarFilter(cat.id)}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer group ${sidebarFilter === cat.id ? "bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300"}`}
                >
                  <span className="group-hover:translate-x-1 transition-transform truncate mr-2">{cat.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-colors ${sidebarFilter === cat.id ? "bg-white dark:bg-[#0B1120] text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-500/20" : "bg-slate-200/50 dark:bg-white/10 text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/20 group-hover:text-blue-600 dark:group-hover:text-blue-400"}`}>
                    {notes.filter(n => n.categoryId === cat.id).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-200/60 dark:border-white/10 flex flex-col gap-2">
          {syncInfo?.portal === 'business' && syncInfo?.isAdmin && (
            <button
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center gap-3 p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors w-full"
            >
              <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">Manage Users</span>
            </button>
          )}

          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-md group-hover:shadow-blue-500/30 transition-shadow shrink-0">
                {syncInfo?.portal === 'business' && syncInfo?.username ? syncInfo.username.charAt(0).toUpperCase() : 'N'}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {syncInfo?.portal === 'business' && syncInfo?.username ? syncInfo.username : 'Notebook'}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold truncate capitalize">{syncInfo?.portal === 'business' ? 'Business Workspace' : 'Personal Workspace'}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Dashboard Top Header */}
        <header className="w-full px-8 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-transparent relative z-10">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="font-extrabold text-2xl tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
              {getGreeting()}, {syncInfo?.portal === 'business' && syncInfo?.username ? syncInfo.username : 'Notebook'} 👋
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              You have {notes.length} notes in your workspace
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {syncInfo?.portal === 'business' && (
              <div className="hidden md:flex bg-slate-100 dark:bg-[#1E293B] p-1 rounded-xl items-center text-xs font-semibold shadow-inner border border-slate-200/50 dark:border-white/5">
                {['All', 'Pending', 'In Review', 'Done'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === s ? 'bg-white dark:bg-[#334155] shadow-sm text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {/* Search Bar matching image */}
            <div className="relative hidden md:block w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-10 py-2.5 rounded-full bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700">⌘K</kbd>
              </div>
            </div>

            <button
              onClick={() => {
                if (selectionMode) exitSelectionMode();
                else setSelectionMode(true);
              }}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-colors shadow-sm cursor-pointer ${
                selectionMode
                  ? "border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-400"
                  : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 bg-white dark:bg-[#0F172A]"
              }`}
            >
              {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {selectionMode ? "Cancel" : "Select"}
            </button>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative flex items-center gap-2 px-4 py-2.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-sm overflow-hidden"
            >
              <motion.span
                className="relative w-2.5 h-2.5 rounded-full bg-emerald-500"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="relative text-xs text-emerald-600 dark:text-emerald-400 font-bold tracking-wide">
                {notes.length} Notes
              </span>
            </motion.div>
            
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0F172A] text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              title="Logout"
            >
              {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {selectionMode && selectedNoteIds.size > 0 && (
          <div className="w-full px-8 -mt-2 mb-2 shrink-0">
            <div className="flex items-center justify-between rounded-xl border border-rose-200/60 dark:border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/30 px-4 py-3">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                {selectedNoteIds.size} note(s) selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>
            </div>
          </div>
        )}

        {syncError && (
          <div className="w-full px-8 -mt-4 mb-2 shrink-0">
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
              <strong>Database sync failed:</strong> {syncError}
            </div>
          </div>
        )}

        {/* Scrollable Main Grid */}
        <main className="flex-1 overflow-y-auto px-8 pb-32">

        
        {/* Mobile-Only Search Bar Pinned at Top */}
        <div className="w-full md:hidden mb-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-[#0F172A]/70 border border-slate-200/60 dark:border-transparent text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/50 shadow-sm dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
            />
          </div>
        </div>

        {/* Search header indicator if active */}
        <AnimatePresence>
          {searchQuery && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="text-xs text-slate-400 dark:text-slate-450 flex items-center gap-1.5 mb-2"
            >
              <span>Showing results for &ldquo;{searchQuery}&rdquo;</span>
              <button 
                onClick={() => setSearchQuery("")}
                className="text-blue-600 dark:text-[#3B82F6] hover:underline cursor-pointer"
              >
                Clear
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading Spinner / Skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-full h-44 rounded-2xl bg-white/40 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 animate-pulse p-6 space-y-4">
                <div className="h-4 bg-slate-200 dark:bg-neutral-800 rounded w-2/3" />
                <div className="space-y-2">
                  <div className="h-3 bg-slate-200 dark:bg-neutral-800 rounded w-full" />
                  <div className="h-3 bg-slate-200 dark:bg-neutral-800 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Responsive CSS Card Grid */
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            <AnimatePresence mode="popLayout">
              {filteredNotes.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full py-20 text-center text-sm text-slate-400 dark:text-slate-500"
                >
                  No notes found matching your search.
                </motion.div>
              ) : syncInfo?.portal === 'business' ? (
                ['Pending', 'In Review', 'Done'].map(statusGroup => {
                  const groupNotes = sortedNotes.filter(n => (n.status || 'Pending') === statusGroup);
                  if (groupNotes.length === 0) return null;
                  return (
                    <motion.div 
                      layout 
                      key={statusGroup} 
                      className="col-span-full mb-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    >
                      <div className="flex items-center gap-2 mb-3 mt-1 ml-1">
                        <div className={`h-2 w-2 rounded-full ${statusGroup === 'Done' ? 'bg-emerald-500' : statusGroup === 'In Review' ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{statusGroup} ({groupNotes.length})</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                        {groupNotes.map(renderNoteCard)}
                      </div>
                    </motion.div>
                  )
                })
              ) : (
                sortedNotes.map(renderNoteCard)
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
      </div>

      {/* Floating Action Bar Pill (Bottom Center) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center gap-4 px-5 py-2.5 rounded-full bg-white/90 dark:bg-[#0B1120]/80 border border-slate-200/50 dark:border-white/10 shadow-xl shadow-slate-200/10 dark:shadow-[#030712]/50 backdrop-blur-md transition-colors duration-500">
          
          {/* New Note Button */}
          <button
            onClick={handleCreateNote}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-[#3B82F6] dark:hover:bg-blue-600 transition-colors shadow-md shadow-blue-500/10 cursor-pointer whitespace-nowrap"
            style={{ minHeight: "40px" }}
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New Note
          </button>

          {/* Install App — hidden when running inside installed standalone app */}
          {!isStandalone && (
            <button
              onClick={handleInstallApp}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs font-bold text-blue-600 dark:text-[#3B82F6] bg-blue-50/80 dark:bg-[#3B82F6]/10 hover:bg-blue-100 dark:hover:bg-[#3B82F6]/20 border border-blue-200/50 dark:border-blue-500/20 transition-colors cursor-pointer"
              style={{ minHeight: "40px" }}
              title={isInstalled ? "App Installed" : "Install App"}
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">{isInstalled ? "App Installed" : "Install App"}</span>
            </button>
          )}

          {/* Search Trigger and Sliding Search Field (Desktop only) */}
          <div className="hidden md:flex items-center">
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 180, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="relative overflow-hidden flex items-center mr-1"
                >
                  <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-2 pr-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-[#0F172A]/70 border border-transparent focus:outline-none text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500"
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer flex items-center justify-center ${showSearch ? 'text-blue-500' : 'text-slate-400 dark:text-neutral-500'}`}
              style={{ minHeight: "40px", minWidth: "40px" }}
              aria-label="Toggle Search"
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <div className="hidden md:block w-[1px] h-5 bg-slate-200 dark:bg-white/10" />

          {/* Theme Toggler Pill */}
          <ThemeToggle />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteDialog && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => !isDeleting && setDeleteDialog(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/50 dark:border-white/5 p-6 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 ring-4 ring-rose-500/5">
                  <Trash2 className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-extrabold text-lg text-slate-800 dark:text-white">
                    {deleteDialog.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[280px]">
                    {deleteDialog.subtitle}
                  </p>
                </div>
                <div className="flex items-center gap-3 w-full pt-2">
                  <button
                    onClick={() => setDeleteDialog(null)}
                    disabled={isDeleting}
                    className="flex-1 h-11 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Keep Note
                  </button>
                  <button
                    onClick={() => void performDelete()}
                    disabled={isDeleting}
                    className="flex-1 h-11 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isDeleting ? (
                      <span className="animate-pulse">Deleting...</span>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Note PIN Authentication Modal */}
      <AnimatePresence>
        {pinModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/50 dark:border-white/5 p-6 shadow-2xl flex flex-col items-center gap-6"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                <KeyRound className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="font-extrabold text-lg text-slate-800 dark:text-white">Enter Notepad PIN</h3>
                <p className="text-xs text-slate-400 dark:text-slate-450 font-medium">This notepad contains confidential records.</p>
              </div>

              {/* Pin indicator circles */}
              <div className="flex items-center gap-4 my-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
                      pinInputValue.length >= i
                        ? "bg-blue-600 border-blue-600 dark:bg-[#3B82F6] dark:border-[#3B82F6] scale-110"
                        : "border-slate-300 dark:border-slate-700 bg-transparent"
                    }`}
                  />
                ))}
              </div>

              {pinError && (
                <span className="text-xs text-rose-500 font-semibold animate-pulse text-center">
                  {pinError}
                </span>
              )}

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] my-1">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                  <button
                    key={digit}
                    onClick={() => handlePinDigitPress(digit)}
                    disabled={isVerifyingPin}
                    className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all text-sm font-extrabold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  onClick={closePinModal}
                  disabled={isVerifyingPin}
                  className="h-12 rounded-xl text-xs font-bold text-slate-400 dark:text-slate-500 hover:bg-slate-100/50 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePinDigitPress("0")}
                  disabled={isVerifyingPin}
                  className="h-12 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all text-sm font-extrabold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  0
                </button>
                <button
                  onClick={() => setPinInputValue((prev) => prev.slice(0, -1))}
                  disabled={isVerifyingPin}
                  className="h-12 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notepad Lock Settings Dialog */}
      <AnimatePresence>
        {lockSettingsOpen && activeNote && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/50 dark:border-white/5 p-6 shadow-2xl flex flex-col gap-6"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                <span className="font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 text-sm">
                  <Lock className="w-4 h-4 text-amber-500" />
                  Notepad Lock Settings
                </span>
                <button 
                  onClick={() => {
                    setLockSettingsOpen(false);
                    setNewPinValue("");
                    setLockSettingsError("");
                  }} 
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-400 dark:text-slate-450 leading-relaxed font-medium">
                  {activeNote.pin 
                    ? "Change the 4-digit lock passcode or click Remove to unlock the notepad." 
                    : "Lock this note with a 4-digit PIN. You will need the PIN to open it again."}
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-450 uppercase tracking-wider">
                    {activeNote.pin ? "New 4-Digit Passcode" : "Set 4-Digit Passcode"}
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="e.g. 1234"
                    value={newPinValue}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length <= 4) {
                        setNewPinValue(val);
                        setLockSettingsError("");
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-white font-mono text-center tracking-widest text-lg"
                  />
                  {lockSettingsError && (
                    <span className="text-[10px] text-rose-500 font-semibold">{lockSettingsError}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 w-full">
                {activeNote.pin && (
                  <button
                    onClick={handleRemoveLock}
                    className="flex-1 h-11 text-xs font-bold text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-transparent cursor-pointer"
                  >
                    Remove Lock
                  </button>
                )}
                <button
                  onClick={handleApplyLock}
                  className="flex-1 h-11 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-[#3B82F6] dark:hover:bg-blue-600 rounded-xl cursor-pointer"
                >
                  {activeNote.pin ? "Update PIN" : "Apply Lock"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Overlay Editor Transition */}
      <AnimatePresence>
        {isEditing && activeNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[60] flex overflow-hidden bg-white/60 dark:bg-[#070B14]/80 backdrop-blur-xl"
          >
            {/* Ambient background animations */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl dark:bg-blue-600/10" 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl dark:bg-indigo-600/10" 
              />
            </div>

            {/* Notes sidebar */}
            <motion.aside 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="hidden md:flex relative w-56 lg:w-60 shrink-0 flex-col border-r border-slate-200/80 dark:border-white/6 bg-white/70 dark:bg-[#0B1120]/90 backdrop-blur-xl shadow-2xl"
            >
              <div className="px-3 py-2.5 border-b border-slate-200/80 dark:border-white/6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Notes</p>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {sortedNotes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => void switchToNoteInEditor(note)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition-all cursor-pointer ${
                      note.id === activeNoteId
                        ? "bg-blue-600/10 dark:bg-blue-500/15 border border-blue-300/40 dark:border-blue-500/30"
                        : "hover:bg-slate-100/80 dark:hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      {note.isLocked && <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                      {note.isPinned && <Pin className="w-2.5 h-2.5 text-blue-500 shrink-0 fill-current" />}
                      <span className="text-xs font-semibold truncate text-slate-800 dark:text-white">
                        {note.title || "Untitled"}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 truncate pl-0.5">
                      {note.isLocked && !note.content ? "PIN protected" : stripHtml(note.content) || "Empty"}
                    </p>
                  </button>
                ))}
              </div>
            </motion.aside>

            <motion.div 
              initial={{ y: 20, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex-1 flex flex-col min-w-0 overflow-hidden px-3 py-2 sm:px-4 sm:py-3"
            >
              {/* Mobile note switcher */}
              <div className="md:hidden shrink-0 mb-2 -mx-1 overflow-x-auto">
                <div className="flex gap-1.5 px-1">
                  {sortedNotes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => void switchToNoteInEditor(note)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer ${
                        note.id === activeNoteId
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                          : "bg-white/80 dark:bg-neutral-900/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-white/8"
                      }`}
                    >
                      {(note.title || "Untitled").slice(0, 16)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col min-h-0">

                {/* Compact top bar */}
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 shrink-0 border-b border-slate-200/60 dark:border-white/6">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={closeEditor}
                      className="h-8 px-2.5 rounded-lg bg-white/80 dark:bg-neutral-900/80 border border-slate-200/60 dark:border-white/8 flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      title="Close editor"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Close</span>
                    </button>
                    <ThemeToggle />
                  </div>

                  <div className="flex items-center gap-1">
                    <AnimatePresence mode="wait">
                      {saveStatus === "saving" && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] text-slate-400 mr-1">Saving…</motion.span>
                      )}
                      {saveStatus === "saved" && (
                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mr-1">Saved</motion.span>
                      )}
                    </AnimatePresence>

                    <button onClick={(e) => handleTogglePin(e, activeNote)} title={activeNote.isPinned ? "Unpin" : "Pin"}
                      className={`h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
                        activeNote.isPinned ? "border-blue-300/50 bg-blue-500/10 text-blue-600" : "border-slate-200/60 dark:border-white/8 text-slate-500 hover:bg-white/80 dark:hover:bg-neutral-900/80"
                      }`}>
                      <Pin className={`w-3.5 h-3.5 ${activeNote.isPinned ? "fill-current" : ""}`} />
                    </button>
                    <button onClick={() => setLockSettingsOpen(true)} title={activeNote.pin ? "Locked" : "Lock"}
                      className={`h-8 w-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${
                        activeNote.pin ? "border-amber-300/50 bg-amber-500/10 text-amber-600" : "border-slate-200/60 dark:border-white/8 text-slate-500 hover:bg-white/80 dark:hover:bg-neutral-900/80"
                      }`}>
                      {activeNote.pin ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={handleSave} title="Save"
                      className="h-8 w-8 rounded-lg border border-slate-200/60 dark:border-white/8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-neutral-900/80 cursor-pointer">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={requestEditorDelete} title="Delete"
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {syncInfo?.portal === "business" && (
                      <button onClick={() => setShowChatPanel(!showChatPanel)} title="Project Chat"
                        className={`h-8 px-2.5 rounded-lg border flex items-center justify-center cursor-pointer transition-all gap-1.5 text-[11px] font-semibold ${
                          showChatPanel 
                            ? "border-blue-300/50 bg-blue-500/10 text-blue-600 dark:text-blue-400" 
                            : "border-slate-200/60 dark:border-white/8 text-slate-500 hover:bg-white/80 dark:hover:bg-neutral-900/80"
                        }`}>
                        <div className="relative">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                          {(() => {
                            const total = activeNote.comments?.length || 0;
                            const unread = Math.max(0, total - (chatReadCounts[activeNote.id] || 0));
                            if (unread > 0) {
                              return <span className="absolute -top-1 -right-1.5 bg-rose-500 text-white text-[8px] font-bold px-1 rounded-full">{unread > 99 ? '99+' : unread}</span>;
                            }
                            return null;
                          })()}
                        </div>
                        <span className="hidden sm:inline">Chat</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Compact title + meta */}
                <div className="shrink-0 mb-2">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Untitled Note"
                    className="w-full text-xl sm:text-2xl font-bold bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-neutral-700 border-none outline-none focus:ring-0 p-0 leading-tight"
                  />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatNoteDate(activeNote.updatedAt)}</span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="flex items-center gap-1">
                      Ref:
                      <input
                        type="text"
                        value={activeNote.patientId || ""}
                        onChange={(e) => handlePatientIdChange(e.target.value)}
                        placeholder="—"
                        className="font-mono text-slate-600 dark:text-blue-400 bg-transparent outline-none border-none focus:ring-0 p-0 w-16"
                      />
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <span className="flex items-center gap-1">
                      Cat:
                      <CategorySelect
                        categories={categories}
                        value={activeNote.categoryId || "general"}
                        onChange={(id) => handleCategoryIdChange(id)}
                      />
                    </span>
                    {syncInfo?.portal === "business" && usersList.length > 0 && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <span className="flex items-center gap-1">
                          <UserAssignSelect
                            users={usersList}
                            selectedUsernames={activeNote.assignedTo || []}
                            onChange={handleAssignedToChange}
                          />
                        </span>
                      </>
                    )}
                    {syncInfo?.portal === "business" && (
                      <>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <span className="flex items-center gap-1">
                          <StatusSelect
                            value={activeNote.status || "Pending"}
                            onChange={handleStatusChange}
                          />
                        </span>
                      </>
                    )}
                    {activeNote.tags?.map((t, idx) => (
                      <span key={idx} className="px-1.5 py-px rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Editor and Chat side-by-side */}
                <div className="flex-1 flex min-h-0 overflow-hidden gap-4">
                  
                  {/* Main Editor */}
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden transition-all duration-300">
                    <Editor
                      key={activeNoteId}
                      content={activeNote.content}
                      onChange={handleContentChange}
                    />
                  </div>

                  {/* Sliding Chat Panel */}
                  <AnimatePresence>
                    {showChatPanel && syncInfo?.portal === "business" && (
                      <motion.div
                        initial={{ width: 0, opacity: 0, x: 20 }}
                        animate={{ width: 320, opacity: 1, x: 0 }}
                        exit={{ width: 0, opacity: 0, x: 20 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="flex-shrink-0 flex flex-col bg-slate-50 dark:bg-neutral-900/50 rounded-2xl border border-slate-200/60 dark:border-white/10 overflow-hidden"
                      >
                        <div className="p-3 border-b border-slate-200/60 dark:border-white/10 flex items-center justify-between bg-white dark:bg-neutral-900">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                            Project Chat
                          </span>
                          <button onClick={() => setShowChatPanel(false)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar">
                          {(!activeNote.comments || activeNote.comments.length === 0) ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center px-4">
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-50"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                              <span className="text-xs font-medium">No messages yet.</span>
                              <span className="text-[10px]">Start the conversation!</span>
                            </div>
                          ) : (
                            activeNote.comments.map(c => {
                              const isMe = c.username === syncInfo?.username;
                              const isImage = c.type === 'image';
                              const isAudio = c.type === 'audio';
                              
                              return (
                                <div key={c.id} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mb-0.5 px-1">{isMe ? 'You' : c.username}</span>
                                  <div className={`px-3 py-2 rounded-2xl text-xs overflow-hidden ${
                                    isMe 
                                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                                      : 'bg-white dark:bg-[#1E293B] border border-slate-200/60 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                                  }`}>
                                    {isImage ? (
                                      <img src={c.mediaData} alt="Shared image" className="max-w-full rounded-lg object-contain mt-1 max-h-48" />
                                    ) : isAudio ? (
                                      <audio src={c.mediaData} controls className="h-8 max-w-[200px] mt-1 outline-none" />
                                    ) : (
                                      <span className="break-words">{c.text}</span>
                                    )}
                                  </div>
                                  <span className="text-[8px] text-slate-400 mt-0.5 px-1">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="p-3 bg-white dark:bg-neutral-900 border-t border-slate-200/60 dark:border-white/10 relative">
                          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                          {isRecording ? (
                            <div className="flex items-center gap-2 justify-between bg-red-50 dark:bg-red-500/10 rounded-xl px-4 py-2 border border-red-200 dark:border-red-500/30">
                              <div className="flex items-center gap-2">
                                <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                <span className="text-xs font-bold text-red-600 dark:text-red-400">Recording... 0:{recordingTime.toString().padStart(2, '0')}</span>
                              </div>
                              <button onClick={stopRecording} className="p-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors">
                                <Square className="w-4 h-4 fill-current" />
                              </button>
                            </div>
                          ) : (
                            <form onSubmit={(e) => { e.preventDefault(); handleSendComment(); }} className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSendingComment}
                                className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-[#0F172A] transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                              </button>
                              
                              <input 
                                type="text" 
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Type a message..."
                                disabled={isSendingComment}
                                className="flex-1 bg-slate-100 dark:bg-[#0F172A] border border-transparent focus:border-blue-500/50 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none transition-colors"
                              />
                              
                              {chatInput.trim() ? (
                                <button 
                                  type="submit"
                                  disabled={isSendingComment}
                                  className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors disabled:opacity-50"
                                >
                                  {isSendingComment ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                  )}
                                </button>
                              ) : (
                                <button 
                                  type="button"
                                  onClick={startRecording}
                                  disabled={isSendingComment}
                                  className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-[#0F172A] transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                                </button>
                              )}
                            </form>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isUserModalOpen && <UserManagementModal onClose={() => setIsUserModalOpen(false)} />}
    </div>
  );
}
