"use client";

import { useEffect, useRef, useState } from "react";

import { Alignment, Fit, Layout, useRive } from "@rive-app/react-webgl2";
import { ArrowLeft, ArrowUp, ChevronRight, Plus, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import {
  type FiscalBackup as Backup,
  type FiscalSave,
  type FiscalSnapshot,
  fiscalBackupDiffers,
  jurisdictions,
  parseFiscalBackup,
} from "@/lib/eli-chat/types";
import { loadFiscalChat, saveFiscalChat } from "@/server/desk-fiscal";

type ChatMessage = { id: number; role: "eli" | "user"; text: string; options?: string[] };
type EliExpression = "neutral" | "happy" | "annoyed";
let lastChatMessageId = 0;

function nextChatMessageId() {
  lastChatMessageId = Math.max(Date.now(), lastChatMessageId + 1);
  return lastChatMessageId;
}

function expressionForText(text = ""): EliExpression {
  const normalized = text.toLocaleLowerCase("es-AR");
  if (/error|incorrect|inv[aá]lid|no puedo|cuit debe|problema/.test(normalized)) return "annoyed";
  if (/hola|gracias|perfecto|listo|bienvenid|genial/.test(normalized)) return "happy";
  return "neutral";
}

function backupKey(snapshot: FiscalSnapshot) {
  return `desk-fiscal:v1:${snapshot.user_id}:${snapshot.organization_id}`;
}
function displayAnswers(answers: FiscalSnapshot["answers"]) {
  return Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [
      key === "jurisdicciones" ? "jurisdiccion" : key,
      Array.isArray(value) ? value.join(", ") : value,
    ]),
  );
}
function wireAnswers(answers: Record<string, string>) {
  const { revision: _review, ...fields } = answers;
  return fields;
}

const questions = [
  { key: "billing_name", text: "¿Cuál es tu nombre o razón social?" },
  {
    key: "legal_form",
    text: "¿Quién será el titular de la facturación?",
    options: ["Persona humana", "SRL", "SA", "SAS"],
  },
  { key: "tax_id_type", text: "¿Qué documento vas a informar?", options: ["CUIT", "DNI"] },
  { key: "tax_id", text: "¿Cuál es tu CUIT o DNI? Ingresá los números juntos, sin puntos ni guiones." },
  {
    key: "vat_condition",
    text: "¿Cuál es tu condición frente al IVA?",
    options: ["Responsable Inscripto", "Monotributista"],
  },
  { key: "fiscal_address", text: "¿Cuál es tu domicilio fiscal?" },
  {
    key: "iibb_category",
    text: "¿Cómo estás inscripto/a en Ingresos Brutos?",
    options: ["Simplificado", "Local", "Multilateral"],
  },
  { key: "iibb_jurisdiction", text: "¿En qué jurisdicción estás inscripto/a?" },
  {
    key: "revision",
    text: "¿Querés revisar los datos antes de completar?",
    options: ["Sí, revisar", "Guardar y completar"],
  },
];

function registrationQuestion(index: number, answers: Record<string, string> = {}): ChatMessage {
  if (index >= questions.length) {
    return {
      id: nextChatMessageId(),
      role: "eli",
      text: "¡Listo! Terminamos las preguntas. Tus respuestas quedaron guardadas en esta preview.",
    };
  }

  const question = questions[index];
  if (question.key === "tax_id_type" && answers.legal_form !== "Persona humana")
    return { id: nextChatMessageId(), role: "eli", text: question.text, options: ["CUIT"] };
  if (question.key === "iibb_jurisdiction" && answers.iibb_category === "Multilateral")
    return {
      id: nextChatMessageId(),
      role: "eli",
      text: "¿En qué jurisdicciones estás inscripto/a? Elegí todas las que correspondan y continuá.",
      options: jurisdictions,
    };
  return { id: nextChatMessageId(), role: "eli", text: question.text, options: question.options };
}

function nextRegistrationStep(currentStep: number, answers: Record<string, string>) {
  if (currentStep === 1 && answers.legal_form !== "Persona humana") return 3;
  return currentStep + 1;
}

function registrationSummary(answers: Record<string, string>, chooseField = false): ChatMessage {
  const editableFields = questions
    .slice(0, -1)
    .filter((item) => answers[item.key]?.trim() && true)
    .map((item) => item.key);
  return {
    id: nextChatMessageId(),
    role: "eli",
    text: `Repasemos lo que me contaste:\n${questions
      .slice(0, -1)
      .map((item) => `${item.text.split(" Ingresá")[0].replace(/[¿?]/g, "")}: ${answers[item.key] || "—"}`)
      .join("\n")}`,
    options: chooseField ? editableFields : ["Guardar y completar", "Corregir datos"],
  };
}

function EliAvatar({ compact = false, expression = "neutral" }: { compact?: boolean; expression?: EliExpression }) {
  const [loaded, setLoaded] = useState(false);
  const [riveReady, setRiveReady] = useState(false);
  const revealTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    },
    [],
  );

  const { RiveComponent, rive } = useRive({
    src: "/eli-bot.riv",
    artboard: "ELI",
    stateMachine: "State Machine 1",
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoad: () => {
      setRiveReady(true);
      revealTimerRef.current = window.setTimeout(() => {
        setLoaded(true);
      }, 3000);
    },
    onLoadError: () => {
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
      setRiveReady(false);
      setLoaded(false);
    },
  });

  useEffect(() => {
    if (!rive || !riveReady) return;
    rive.play(rive.animationNames.includes(expression) ? expression : "idle");
  }, [expression, rive, riveReady]);

  return (
    <div
      className={`eli-avatar ${compact ? "eli-avatar--compact" : ""} ${loaded ? "eli-avatar--loaded" : ""}`}
      aria-label="Avatar de ELI"
      role="img"
    >
      <RiveComponent aria-hidden="true" />
    </div>
  );
}

function TypewriterText({ text, onComplete, speed = 24 }: { text: string; onComplete?: () => void; speed?: number }) {
  const [visibleText, setVisibleText] = useState("");
  const [typing, setTyping] = useState(true);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleText(text);
      setTyping(false);
      onCompleteRef.current?.();
      return;
    }
    let index = 0;
    let timer = 0;
    const typeNextCharacter = () => {
      index += 1;
      setVisibleText(text.slice(0, index));
      if (index < text.length) {
        timer = window.setTimeout(typeNextCharacter, speed);
      } else {
        setTyping(false);
        onCompleteRef.current?.();
      }
    };
    timer = window.setTimeout(typeNextCharacter, speed);
    return () => window.clearTimeout(timer);
  }, [speed, text]);

  return (
    <span className="eli-typewriter">
      <span>{visibleText}</span>
      {typing && <span className="eli-typewriter-cursor" aria-hidden="true" />}
    </span>
  );
}

export function FiscalChat({
  open,
  onDismiss,
  onSnapshot,
}: {
  open: boolean;
  onDismiss: () => void;
  onSnapshot: (data: FiscalSnapshot) => void;
}) {
  const [started, setStarted] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [opening, setOpening] = useState(false);
  const [welcomeTitleTyped, setWelcomeTitleTyped] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [registrationStep, setRegistrationStep] = useState<number | null>(null);
  const [registrationActive, setRegistrationActive] = useState(false);
  const [registrationAnswers, setRegistrationAnswers] = useState<Record<string, string>>({});
  const [, setRegistrationCompleted] = useState(false);
  const [reviewMode, setReviewMode] = useState<"confirm" | "chooseField" | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [typedMessageIds, setTypedMessageIds] = useState<Set<number>>(() => new Set());
  const [messageList, setMessageList] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queuedMessageRef = useRef<{ afterId: number; message: ChatMessage } | null>(null);

  const [snapshot, setSnapshot] = useState<FiscalSnapshot | null>(null);
  const [saveStatus, setSaveStatus] = useState("Recuperando datos…");
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const pendingRef = useRef<FiscalSave | null>(null);
  const [conflict, setConflict] = useState<{ remote: FiscalSnapshot; local: Backup } | null>(null);
  const [selectedJurisdictions, setSelectedJurisdictions] = useState<string[]>([]);

  function writeBackup(data: FiscalSnapshot, pending?: FiscalSave) {
    const backup: Backup = {
      version: 1,
      answers: pending ? displayAnswers(pending.answers) : displayAnswers(data.answers),
      revision: data.revision,
      step: pending?.step ?? data.progress?.step ?? 0,
      reviewMode: pending?.reviewMode ?? data.progress?.review_mode ?? null,
      pending,
    };
    try {
      window.localStorage.setItem(backupKey(data), JSON.stringify(backup));
    } catch {
      setSaveStatus("Guardado en servidor. El respaldo local no está disponible.");
    }
  }

  function acceptSnapshot(data: FiscalSnapshot) {
    setSnapshot(data);
    onSnapshot(data);
    setRegistrationAnswers(displayAnswers(data.answers));
    setRegistrationStep(data.progress?.step ?? 0);
    setReviewMode(data.progress?.review_mode ?? null);
    setRegistrationCompleted(data.progress?.status === "confirmed");
    setSelectedJurisdictions([]);
  }

  function currentPrompt(data: FiscalSnapshot): ChatMessage {
    if (data.progress?.review_mode === "confirm") return registrationSummary(displayAnswers(data.answers));
    if (data.progress?.review_mode === "chooseField") return registrationSummary(displayAnswers(data.answers), true);
    return registrationQuestion(data.progress?.step ?? 0, displayAnswers(data.answers));
  }

  function presentSaved(data: FiscalSnapshot) {
    acceptSnapshot(data);
    if (data.progress?.status === "confirmed") {
      setStarted(false);
      onDismiss();
      setRegistrationActive(false);
      setLoading(false);
      setThinking(false);
      return;
    }
    setRegistrationActive(!data.progress?.review_mode);
    setLoading(true);
    setThinking(false);
    setMessages((current) => [...current, currentPrompt(data)]);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function runSave(input: FiscalSave, base = snapshot) {
    if (!base || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    setSaveStatus("Guardando…");
    pendingRef.current = input;
    writeBackup(base, input);
    try {
      const result = await saveFiscalChat(input);
      if (!result.data) {
        setSaveError(true);
        setSaveStatus(result.error);
        setLoading(false);
        setThinking(false);
        if (result.conflict) {
          const remote = await loadFiscalChat();
          if (remote.data)
            setConflict({
              remote: remote.data,
              local: {
                version: 1,
                answers: displayAnswers(input.answers),
                revision: base.revision,
                step: input.step,
                reviewMode: input.reviewMode,
                pending: input,
              },
            });
        }
        return;
      }
      pendingRef.current = null;
      writeBackup(result.data);
      setSaveStatus("Guardado");
      presentSaved(result.data);
    } catch {
      setSaveError(true);
      setSaveStatus("No hay conexión. Conservamos tus respuestas; reintentá.");
      setLoading(false);
      setThinking(false);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function persist(
    answers: Record<string, string>,
    step: number,
    review: Backup["reviewMode"] = null,
    complete = false,
  ) {
    if (!snapshot) return;
    void runSave({
      answers: wireAnswers(answers),
      expectedRevision: snapshot.revision,
      requestId: crypto.randomUUID(),
      step,
      reviewMode: review,
      complete,
    });
  }

  async function recover() {
    setSaveError(false);
    setSaveStatus("Recuperando datos…");
    try {
      const result = await loadFiscalChat();
      if (!result.data) {
        setSaveError(true);
        setSaveStatus(result.error);
        return;
      }
      const remote = result.data;
      let local: Backup | null = null;
      const serverBackup: Backup = {
        version: 1,
        answers: displayAnswers(remote.answers),
        revision: remote.revision,
        step: remote.progress?.step ?? 0,
        reviewMode: remote.progress?.review_mode ?? null,
      };
      acceptSnapshot(remote);
      try {
        const raw = window.localStorage.getItem(backupKey(remote));
        if (raw) local = parseFiscalBackup(raw);
      } catch {
        setConflict({ remote, local: { ...serverBackup, unreadable: true } });
        setSaveStatus("El respaldo local no se puede interpretar. Elegí recuperar el servidor.");
        return;
      }
      if (local?.pending) {
        const pending = local.pending;
        const requestAlreadySaved =
          remote.last_request_id === pending.requestId && remote.revision === pending.expectedRevision + 1;
        if (requestAlreadySaved) {
          writeBackup(remote);
          setSaveStatus("Guardado");
          return;
        }
        if (remote.revision === pending.expectedRevision) {
          setSaveStatus("Recuperando el último guardado…");
          await runSave(pending, remote);
          return;
        }
      }
      if (local && fiscalBackupDiffers(local, serverBackup)) {
        setConflict({ remote, local });
        setSaveStatus("Hay un respaldo local diferente. Revisá cómo continuar.");
        return;
      }
      writeBackup(remote);
      setSaveStatus("Guardado");
    } catch {
      setSaveError(true);
      setSaveStatus("No pudimos conectar. Reintentá la recuperación.");
    }
  }

  function finishTyping(messageId: number) {
    setTypedMessageIds((current) => new Set(current).add(messageId));
    setThinking(false);
    const queued = queuedMessageRef.current;
    if (queued?.afterId === messageId) {
      queuedMessageRef.current = null;
      setMessages((current) => [...current, queued.message]);
      return;
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!messageList) return;

    let frame = 0;
    const scrollToLatest = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        messageList.scrollTo({ top: messageList.scrollHeight, behavior: "instant" });
      });
    };
    scrollToLatest();

    const observer = new MutationObserver(scrollToLatest);
    observer.observe(messageList, { childList: true, subtree: true, characterData: true });
    const resizeObserver = new ResizeObserver(scrollToLatest);
    resizeObserver.observe(messageList);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [messageList]);

  useEffect(() => {
    if (!open) {
      setStarted(false);
      setHasEntered(false);
      setWelcomeTitleTyped(false);
    }
  }, [open]);

  async function startConversation() {
    if (conflict || pendingRef.current || saving || opening) return;
    setOpening(true);
    setSaveError(false);
    setSaveStatus("Recuperando datos…");
    try {
      const result = await loadFiscalChat();
      if (!result.data) {
        setSaveError(true);
        setSaveStatus(result.error);
        return;
      }
      const saved = result.data;
      const serverBackup: Backup = {
        version: 1,
        answers: displayAnswers(saved.answers),
        revision: saved.revision,
        step: saved.progress?.step ?? 0,
        reviewMode: saved.progress?.review_mode ?? null,
      };
      acceptSnapshot(saved);
      setRegistrationAnswers(serverBackup.answers);
      setRegistrationStep(serverBackup.step);
      setReviewMode(serverBackup.reviewMode);
      setRegistrationCompleted(saved.progress?.status === "confirmed");
      setSelectedJurisdictions([]);

      let local: Backup | null = null;
      try {
        const raw = window.localStorage.getItem(backupKey(saved));
        if (raw) local = parseFiscalBackup(raw);
      } catch {
        setHasEntered(true);
        setStarted(true);
        setConflict({ remote: saved, local: { ...serverBackup, unreadable: true } });
        setSaveStatus("El respaldo local no se puede interpretar. Elegí recuperar el servidor.");
        return;
      }

      if (local?.pending) {
        const pendingSaved =
          saved.last_request_id === local.pending.requestId && saved.revision === local.pending.expectedRevision + 1;
        if (pendingSaved) {
          writeBackup(saved);
          local = serverBackup;
        } else if (saved.revision === local.pending.expectedRevision) {
          setHasEntered(true);
          setStarted(true);
          setRegistrationAnswers(displayAnswers(local.pending.answers));
          setRegistrationStep(local.pending.step);
          setReviewMode(local.pending.reviewMode);
          setRegistrationActive(true);
          setLoading(true);
          await runSave(local.pending, saved);
          return;
        }
      }

      if (local && fiscalBackupDiffers(local, serverBackup)) {
        setHasEntered(true);
        setStarted(true);
        setRegistrationAnswers(local.answers);
        setRegistrationStep(local.step);
        setReviewMode(local.reviewMode);
        setConflict({ remote: saved, local });
        setSaveStatus("Hay respuestas diferentes guardadas. Elegí cómo continuar.");
        return;
      }

      writeBackup(saved);
      if (saved.progress?.status === "confirmed") return;
      setHasEntered(true);
      setStarted(true);
      setRegistrationActive(!saved.progress?.review_mode);
      setTypedMessageIds(new Set());
      const greeting: ChatMessage = {
        id: nextChatMessageId(),
        role: "eli",
        text: "¡Hola! Soy ELI. Vamos con unas preguntas para conocer tu negocio.",
      };
      queuedMessageRef.current = { afterId: greeting.id, message: currentPrompt(saved) };
      setMessages([greeting]);
      setLoading(true);
      setThinking(false);
      window.setTimeout(() => inputRef.current?.focus(), 450);
    } catch {
      setSaveError(true);
      setSaveStatus("No pudimos recuperar tus datos. Volvé a pulsar Comenzar para reintentar.");
    } finally {
      setOpening(false);
    }
  }

  function reviewCompletedAnswers() {
    if (!snapshot || saving || conflict || pendingRef.current) return;
    const answers = Object.keys(registrationAnswers).length ? registrationAnswers : displayAnswers(snapshot.answers);
    if (!questions.slice(0, -1).some((question) => answers[question.key]?.trim())) {
      reset();
      return;
    }
    queuedMessageRef.current = null;
    setStarted(true);
    setRegistrationActive(false);
    setRegistrationStep(null);
    setReviewMode("chooseField");
    setLoading(false);
    setThinking(false);
    setTypedMessageIds(new Set());
    setMessages([registrationSummary(answers, true)]);
  }

  function send(text = draft) {
    if (!text.trim() || loading || saving || conflict || pendingRef.current) return;
    if (registrationActive && registrationStep !== null) answerRegistration(text.trim());
  }

  function answerRegistration(value: string) {
    if (registrationStep === null || loading || saving || conflict || pendingRef.current) return;
    const currentStep = registrationStep;
    const question = questions[currentStep];
    if (!question) return;
    const answer = value.trim();
    if (
      (question.key === "tax_id" &&
        !(registrationAnswers.tax_id_type === "DNI" ? /^\d{7,8}$/ : /^\d{11}$/).test(answer)) ||
      (question.options && !question.options.includes(answer))
    ) {
      setLoading(true);
      setMessages((current) => [
        ...current,
        {
          id: nextChatMessageId(),
          role: "eli",
          text:
            question.key === "tax_id"
              ? "Revisá el documento: CUIT de 11 números o DNI de 7 u 8, sin separadores."
              : "Elegí una de las opciones indicadas.",
        },
      ]);
      return;
    }
    const updated = { ...registrationAnswers, [question.key]: answer };
    const wasEditingField = editingField === question.key;
    if (question.key === "legal_form" && answer !== "Persona humana") {
      updated.tax_id_type = "CUIT";
      if (updated.tax_id && !/^\d{11}$/.test(updated.tax_id)) updated.tax_id = "";
    }
    if (question.key === "tax_id_type" && answer !== registrationAnswers.tax_id_type) updated.tax_id = "";
    if (question.key === "iibb_category" && answer !== registrationAnswers.iibb_category)
      delete updated.iibb_jurisdiction;
    setRegistrationAnswers(updated);
    if (wasEditingField) setEditingField(null);
    setDraft("");
    setLoading(true);
    setThinking(true);
    setMessages((current) => [...current, { id: nextChatMessageId(), role: "user", text: answer }]);
    const next = wasEditingField ? questions.length - 1 : nextRegistrationStep(currentStep, updated);
    persist(
      updated,
      next,
      wasEditingField || (question.key === "revision" && answer === "Sí, revisar") ? "confirm" : null,
      question.key === "revision" && answer === "Guardar y completar",
    );
  }

  function handleReviewOption(value: string) {
    if (saving || conflict || pendingRef.current) return;
    if (reviewMode === "confirm" && value === "Guardar y completar") {
      setLoading(true);
      persist(registrationAnswers, questions.length, null, true);
      return;
    }
    if (reviewMode === "confirm" && value === "Corregir datos") {
      setLoading(true);
      persist(registrationAnswers, questions.length, "chooseField");
      return;
    }
    if (reviewMode === "chooseField") {
      const index = questions.findIndex((q) => q.key === value);
      if (index >= 0) {
        setEditingField(value);
        setRegistrationStep(index);
        setRegistrationActive(true);
        setReviewMode(null);
        setDraft("");
        setLoading(true);
        setMessages((current) => [...current, registrationQuestion(index, registrationAnswers)]);
        window.setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  }

  function reset() {
    // Closing never discards persisted answers or the pending local backup.
    setStarted(false);
    onDismiss();
    setRegistrationCompleted(false);
    setMessages([]);
    setTypedMessageIds(new Set());
    queuedMessageRef.current = null;
    setLoading(false);
    setThinking(false);
    setRegistrationActive(false);
  }

  function editPending() {
    const pending = pendingRef.current;
    if (!pending || !snapshot) return;
    pendingRef.current = null;
    setSaveError(false);
    setSaveStatus("Corregí la respuesta antes de volver a guardar.");
    setLoading(false);
    setThinking(false);
    if (!reviewMode && registrationStep !== null)
      setDraft(displayAnswers(pending.answers)[questions[registrationStep]?.key] ?? "");
  }

  async function resolveConflict(useLocal: boolean) {
    if (!conflict) return;
    const { remote, local } = conflict;
    setConflict(null);
    acceptSnapshot(remote);
    if (!useLocal) {
      pendingRef.current = null;
      writeBackup(remote);
      setSaveError(false);
      setSaveStatus("Recuperado del servidor");
      if (started) presentSaved(remote);
      return;
    }
    setStarted(true);
    setLoading(true);
    if (
      local.pending &&
      (remote.revision === local.pending.expectedRevision ||
        (remote.last_request_id === local.pending.requestId && remote.revision === local.pending.expectedRevision + 1))
    ) {
      await runSave(local.pending, remote);
      return;
    }
    await runSave(
      {
        answers: wireAnswers(local.answers),
        expectedRevision: remote.revision,
        requestId: crypto.randomUUID(),
        step: local.step,
        reviewMode: local.reviewMode,
        complete: local.pending?.complete ?? false,
      },
      remote,
    );
  }

  const lastEliMessage = [...messages].reverse().find((message) => message.role === "eli");
  const currentExpression = expressionForText(lastEliMessage?.text);

  return (
    <>
      {open && !hasEntered && (
        <DialogPrimitive.Root
          open
          onOpenChange={(next) => {
            if (!next) reset();
          }}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="eli-modal-backdrop">
              <DialogPrimitive.Content
                className="eli-chat-window eli-welcome-modal"
                aria-describedby="fiscal-welcome-description"
              >
                <DialogPrimitive.Title className="sr-only">Hola, soy ELI</DialogPrimitive.Title>
                <div className="eli-welcome-card">
                  <button type="button" className="eli-completion-close" onClick={reset} aria-label="Cerrar y posponer">
                    <X size={20} />
                  </button>
                  <div className="eli-welcome-avatar">
                    <EliAvatar />
                  </div>
                  <div className="eli-welcome-copy">
                    <p>
                      <strong>
                        <TypewriterText text="Hola, soy ELI" speed={68} onComplete={() => setWelcomeTitleTyped(true)} />
                      </strong>
                      <br />
                      <span id="fiscal-welcome-description" className="eli-welcome-copy__business">
                        {welcomeTitleTyped && (
                          <TypewriterText text="Quiero conocer un poco más tu negocio." speed={32} />
                        )}
                      </span>
                    </p>
                    {saveError && (
                      <p role="alert" className="eli-completion-message">
                        {saveStatus}
                      </p>
                    )}
                    <button
                      type="button"
                      className="eli-primary-button"
                      disabled={opening || saving || !!conflict || !!pendingRef.current}
                      onClick={() => void startConversation()}
                    >
                      {opening ? "Recuperando datos…" : "Comenzar"} <ChevronRight aria-hidden="true" size={20} />
                    </button>
                    <button type="button" className="eli-welcome-postpone" onClick={reset}>
                      Recordármelo más tarde
                    </button>
                  </div>
                  <div className="eli-card-spark eli-card-spark--two" />
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Overlay>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
      {started && open && hasEntered && (
        <DialogPrimitive.Root
          open
          onOpenChange={(next) => {
            if (!next) reset();
          }}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="eli-modal-backdrop">
              <DialogPrimitive.Content className="eli-chat-window" aria-describedby="fiscal-chat-description">
                <header className="eli-chat-header">
                  <button
                    type="button"
                    className="eli-icon-button eli-chat-back"
                    onClick={reviewCompletedAnswers}
                    disabled={saving || !!conflict || !!pendingRef.current}
                    aria-label="Volver a respuestas guardadas"
                  >
                    <ArrowLeft size={19} />
                  </button>
                  <div className="eli-header-avatar">
                    <EliAvatar compact expression={currentExpression} />
                  </div>
                  <div className="eli-header-copy">
                    <strong>
                      <DialogPrimitive.Title asChild>
                        <span>
                          ELI BOT<sup>®</sup>
                        </span>
                      </DialogPrimitive.Title>
                    </strong>
                    <DialogPrimitive.Description id="fiscal-chat-description">
                      Datos fiscales · ELI Desk
                    </DialogPrimitive.Description>
                  </div>
                  <button
                    type="button"
                    className="eli-icon-button eli-chat-close"
                    onClick={reset}
                    aria-label="Cerrar chat"
                  >
                    <X size={19} />
                  </button>
                </header>
                <div className="eli-save-feedback">
                  <button type="button" onClick={reset}>
                    Recordármelo más tarde
                  </button>
                  <output aria-live="polite">{saveStatus}</output>
                  {snapshot?.email && <span className="eli-fiscal-email">Correo: {snapshot.email}</span>}
                  {saveError && !conflict && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => (pendingRef.current ? void runSave(pendingRef.current) : void recover())}
                    >
                      Reintentar
                    </button>
                  )}
                  {saveError && pendingRef.current && !conflict && (
                    <button type="button" onClick={editPending}>
                      Corregir respuesta
                    </button>
                  )}
                </div>
                <div className="eli-chat-content" ref={setMessageList}>
                  {messages.length > 0 && (
                    <div className="eli-message-list">
                      {messages.map((message, index) => (
                        <div key={message.id} className={`eli-message eli-message--${message.role}`}>
                          {message.role === "eli" && index > 0 && (
                            <span className="eli-message-avatar">
                              <EliAvatar compact expression={expressionForText(message.text)} />
                            </span>
                          )}
                          <p>
                            {message.role === "eli" && !typedMessageIds.has(message.id) ? (
                              <TypewriterText text={message.text} onComplete={() => finishTyping(message.id)} />
                            ) : (
                              message.text
                            )}
                          </p>
                        </div>
                      ))}
                      {reviewMode === "chooseField" &&
                        messages.at(-1)?.options &&
                        typedMessageIds.has(messages.at(-1)?.id ?? -1) && (
                          <fieldset className="eli-review-fields">
                            <legend>Elegí un dato para corregir</legend>
                            {messages.at(-1)?.options?.map((option) => {
                              const question = questions.find((item) => item.key === option);
                              if (!question) return null;
                              return (
                                <div className="eli-review-field" key={option}>
                                  <span className="eli-review-field__value">
                                    <span>{question.text.split(" Ingresá")[0].replace(/[¿?]/g, "")}</span>
                                    <strong>{registrationAnswers[option] || "Sin completar"}</strong>
                                  </span>
                                  <button
                                    type="button"
                                    disabled={loading || saving || !!conflict || !!pendingRef.current}
                                    onClick={() => handleReviewOption(option)}
                                  >
                                    Corregir
                                  </button>
                                </div>
                              );
                            })}
                          </fieldset>
                        )}
                      {reviewMode !== "chooseField" &&
                        (registrationActive || reviewMode !== null) &&
                        messages.at(-1)?.options &&
                        typedMessageIds.has(messages.at(-1)?.id ?? -1) && (
                          <fieldset className="eli-option-pills">
                            <legend className="eli-visually-hidden">Opciones de respuesta</legend>
                            {messages.at(-1)?.options?.map((option) => (
                              <button
                                type="button"
                                key={option}
                                disabled={loading || saving || !!conflict || !!pendingRef.current}
                                aria-pressed={
                                  registrationStep === 7 && registrationAnswers.iibb_category === "Multilateral"
                                    ? selectedJurisdictions.includes(option)
                                    : undefined
                                }
                                onClick={() => {
                                  if (registrationStep === 7 && registrationAnswers.iibb_category === "Multilateral")
                                    setSelectedJurisdictions((current) =>
                                      current.includes(option)
                                        ? current.filter((item) => item !== option)
                                        : [...current, option],
                                    );
                                  else if (reviewMode) handleReviewOption(option);
                                  else answerRegistration(option);
                                }}
                              >
                                {option}
                              </button>
                            ))}
                            {registrationStep === 7 && registrationAnswers.iibb_category === "Multilateral" && (
                              <button
                                type="button"
                                disabled={
                                  !selectedJurisdictions.length ||
                                  loading ||
                                  saving ||
                                  !!conflict ||
                                  !!pendingRef.current
                                }
                                onClick={() => answerRegistration(selectedJurisdictions.join(", "))}
                              >
                                Continuar
                              </button>
                            )}
                          </fieldset>
                        )}
                      {thinking && (
                        <div className="eli-message eli-message--eli">
                          <span className="eli-message-avatar">
                            <EliAvatar compact expression={currentExpression} />
                          </span>
                          <p className="eli-typing">
                            <i />
                            <i />
                            <i />
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <form
                  className="eli-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    send();
                  }}
                >
                  <button type="button" className="eli-composer-add" aria-label="Nueva conversación" onClick={reset}>
                    <Plus size={19} />
                  </button>
                  <input
                    ref={inputRef}
                    disabled={saving || !!conflict || !!pendingRef.current || !registrationActive}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Escribí tu mensaje..."
                    aria-label="Mensaje"
                  />
                  <button
                    className="eli-send-button"
                    type="submit"
                    disabled={
                      !draft.trim() || loading || saving || !!conflict || !!pendingRef.current || !registrationActive
                    }
                    aria-label="Enviar mensaje"
                  >
                    <ArrowUp size={19} />
                  </button>
                </form>
                <p className="eli-chat-disclaimer">ELI puede cometer errores. Revisá la información importante.</p>
              </DialogPrimitive.Content>
            </DialogPrimitive.Overlay>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
      {conflict && (
        <div className="eli-modal-backdrop">
          <section
            className="eli-conflict"
            role="dialog"
            aria-modal="true"
            aria-label="Resolver diferencias de guardado"
          >
            <h2>{conflict.local.unreadable ? "Respaldo local ilegible" : "Hay respuestas diferentes"}</h2>
            <p>
              Servidor: revisión {conflict.remote.revision}. Respaldo local: revisión {conflict.local.revision}. Elegí
              qué conservar antes de continuar.
            </p>
            <details>
              <summary>Ver diferencias</summary>
              {Array.from(
                new Set([
                  ...Object.keys(conflict.local.answers),
                  ...Object.keys(displayAnswers(conflict.remote.answers)),
                ]),
              )
                .filter((key) => conflict.local.answers[key] !== displayAnswers(conflict.remote.answers)[key])
                .map((key) => (
                  <p key={key}>
                    <strong>{key}</strong>
                    <br />
                    Servidor: {displayAnswers(conflict.remote.answers)[key] || "—"}
                    <br />
                    Local: {conflict.local.answers[key] || "—"}
                  </p>
                ))}
            </details>
            <button type="button" onClick={() => void resolveConflict(false)}>
              Usar datos del servidor
            </button>
            <button type="button" disabled={conflict.local.unreadable} onClick={() => void resolveConflict(true)}>
              Guardar mis respuestas locales
            </button>
          </section>
        </div>
      )}
    </>
  );
}
