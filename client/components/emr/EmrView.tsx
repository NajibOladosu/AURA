import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Lock, ShieldCheck, Download, Trash2, Plus, FileText,
  Activity, Pill, AlertTriangle, Stethoscope, Syringe, Phone, User as UserIcon, History,
} from 'lucide-react';
import { Card, Button, Input, InkPanel, cn } from '../UIComponents';
import type {
  MedicalRecord, Allergy, Condition, Medication, Immunization, Procedure,
  EmergencyContact, Vital, MedicalDocumentMeta, AuditEntry, VitalType,
} from '../../lib/types';

interface EmrViewProps {
  token: string | null;
  onBack: () => void;
}

const VITAL_LABELS: Record<VitalType, { label: string; unit: string }> = {
  bp: { label: 'Blood pressure', unit: 'mmHg' },
  hr: { label: 'Heart rate', unit: 'bpm' },
  temp: { label: 'Temperature', unit: '°C' },
  glucose: { label: 'Glucose', unit: 'mg/dL' },
  spo2: { label: 'Oxygen (SpO₂)', unit: '%' },
  weight: { label: 'Weight', unit: 'kg' },
};

const fmtDate = (ts: number) => new Date(ts).toLocaleString();

export const EmrView: React.FC<EmrViewProps> = ({ token, onBack }) => {
  const [emrToken, setEmrToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'record' | 'vitals' | 'documents' | 'audit'>('record');

  const authHeaders = useCallback((withEmr = true): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (withEmr && emrToken) h['X-EMR-Access'] = emrToken;
    return h;
  }, [token, emrToken]);

  // ---- Re-auth ----
  const reauth = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: authHeaders(false),
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-authentication failed');
      setEmrToken(data.emrToken);
      setPassword('');
      // Auto-expire the local token slightly before the server does.
      setTimeout(() => setEmrToken(null), (data.expiresIn - 5) * 1000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- Load record ----
  const load = useCallback(async () => {
    if (!emrToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/emr', { headers: authHeaders() });
      if (res.status === 403) { setEmrToken(null); throw new Error('Session locked — re-authenticate.'); }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load record');
      setRecord(data.record);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [emrToken, authHeaders]);

  useEffect(() => { if (emrToken) load(); }, [emrToken, load]);

  const loadAudit = useCallback(async () => {
    try {
      const res = await fetch('/api/emr/audit', { headers: authHeaders(false) });
      if (res.ok) setAudit(await res.json());
    } catch { /* non-critical */ }
  }, [authHeaders]);

  useEffect(() => { if (tab === 'audit' && emrToken) loadAudit(); }, [tab, emrToken, loadAudit]);

  // ---- Persist section edits ----
  const saveSection = async (patch: Partial<MedicalRecord>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/emr', {
        method: 'PUT', headers: authHeaders(), body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setRecord(data.record);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const addVital = async (type: VitalType, value: string, unit: string) => {
    const res = await fetch('/api/emr/vitals', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ type, value, unit }),
    });
    if (res.ok) load();
  };
  const deleteVital = async (id: string) => {
    const res = await fetch(`/api/emr/vitals/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) load();
  };

  const uploadDoc = async (file: File, category: string) => {
    const b64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    const res = await fetch('/api/emr/documents', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ filename: file.name, mimeType: file.type, category, data: b64 }),
    });
    if (res.ok) load();
  };
  const downloadDoc = async (doc: MedicalDocumentMeta) => {
    const res = await fetch(`/api/emr/documents/${doc.id}`, { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const a = document.createElement('a');
    a.href = `data:${doc.mimeType};base64,${data.data}`;
    a.download = doc.filename;
    a.click();
  };
  const deleteDoc = async (id: string) => {
    const res = await fetch(`/api/emr/documents/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) load();
  };

  const exportRecord = async () => {
    const res = await fetch('/api/emr/export', { headers: authHeaders() });
    if (!res.ok) return;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aura-medical-record.json';
    a.click();
  };

  // ---- Guards ----
  if (!token) {
    return (
      <Shell onBack={onBack}>
        <Card className="mx-auto max-w-md p-8 text-center">
          <Lock className="mx-auto mb-4 text-muted-foreground" size={32} />
          <h3 className="mb-2 text-lg font-bold">Sign in required</h3>
          <p className="text-[14px] text-muted-foreground">Your medical record is encrypted and tied to your account. Sign in to view it.</p>
        </Card>
      </Shell>
    );
  }

  if (!emrToken) {
    return (
      <Shell onBack={onBack}>
        <Card className="mx-auto max-w-md p-8">
          <ShieldCheck className="mx-auto mb-4 text-teal-bright" size={32} />
          <h3 className="mb-1 text-center text-lg font-bold">Confirm it's you</h3>
          <p className="mb-5 text-center text-[13.5px] text-muted-foreground">
            Your medical record is encrypted. Re-enter your password to unlock it for 5 minutes.
          </p>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && password && reauth()}
            autoFocus
          />
          {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
          <Button className="mt-4 w-full" disabled={!password || loading} onClick={reauth}>
            {loading ? 'Unlocking…' : 'Unlock record'}
          </Button>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell onBack={onBack}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-teal-bright">
            <ShieldCheck size={14} /> Encrypted · unlocked
          </div>
          <h2 className="text-[clamp(26px,4vw,44px)] font-extrabold leading-none tracking-[-0.02em]">Medical record</h2>
        </div>
        <Button variant="outline" size="sm" onClick={exportRecord}><Download size={15} /> Export</Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {([['record', 'Record'], ['vitals', 'Vitals'], ['documents', 'Documents'], ['audit', 'Access log']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('rounded-full px-4 py-2 text-[13.5px] font-bold transition-colors',
              tab === k ? 'bg-primary text-primary-foreground' : 'bg-foreground/[0.05] text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-[13px] text-destructive">{error}</p>}
      {loading && !record && <p className="text-[14px] text-muted-foreground">Loading…</p>}

      {record && tab === 'record' && <RecordTab record={record} onSave={saveSection} />}
      {record && tab === 'vitals' && <VitalsTab vitals={record.vitals} onAdd={addVital} onDelete={deleteVital} />}
      {record && tab === 'documents' && <DocumentsTab docs={record.documents} onUpload={uploadDoc} onDownload={downloadDoc} onDelete={deleteDoc} />}
      {tab === 'audit' && <AuditTab entries={audit} />}
    </Shell>
  );
};

// ---------------------------------------------------------------------------

const Shell: React.FC<{ children: React.ReactNode; onBack: () => void }> = ({ children, onBack }) => (
  <motion.div
    key="emr"
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
    transition={{ duration: 0.3 }}
    className="mx-auto w-full max-w-[960px] px-4 pb-20 pt-[clamp(28px,6vh,56px)] md:px-6"
  >
    {children}
    <button onClick={onBack} className="mt-8 inline-flex items-center gap-2 text-[13.5px] font-semibold text-muted-foreground/70 transition-colors hover:text-accent">
      <ArrowLeft size={14} /> Back to home
    </button>
  </motion.div>
);

const SectionCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <Card className="p-[clamp(18px,2.6vw,26px)]">
    <div className="mb-4 flex items-center gap-2.5">
      <span className="text-teal-bright">{icon}</span>
      <h3 className="text-[15.5px] font-bold">{title}</h3>
    </div>
    {children}
  </Card>
);

// ---- Record tab: demographics + clinical lists ----
const RecordTab: React.FC<{ record: MedicalRecord; onSave: (p: Partial<MedicalRecord>) => void }> = ({ record, onSave }) => {
  const d = record.demographics;
  const [demo, setDemo] = useState(d);
  useEffect(() => setDemo(d), [d]);

  const demoField = (label: string, key: keyof typeof demo, type = 'text') => (
    <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-muted-foreground">
      {label}
      <Input type={type} value={(demo[key] as any) ?? ''} onChange={(e) => setDemo({ ...demo, [key]: e.target.value || null })} />
    </label>
  );

  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
      <SectionCard icon={<UserIcon size={18} />} title="Demographics">
        <div className="grid grid-cols-2 gap-3">
          {demoField('Date of birth', 'dob', 'date')}
          {demoField('Sex', 'sex')}
          {demoField('Blood type', 'bloodType')}
          {demoField('Phone', 'phone', 'tel')}
          {demoField('Height (cm)', 'heightCm', 'number')}
          {demoField('Weight (kg)', 'weightKg', 'number')}
        </div>
        <Button size="sm" className="mt-4" onClick={() => onSave({ demographics: demo })}>Save demographics</Button>
      </SectionCard>

      <EmergencyContacts contacts={record.emergencyContacts} onSave={(c) => onSave({ emergencyContacts: c })} />

      <AllergyList items={record.allergies} onSave={(a) => onSave({ allergies: a })} />
      <ConditionList items={record.conditions} onSave={(c) => onSave({ conditions: c })} />
      <MedicationList items={record.medications} onSave={(m) => onSave({ medications: m })} />

      <SimpleList<Immunization>
        icon={<Syringe size={18} />} title="Immunizations" items={record.immunizations}
        fields={[['vaccine', 'Vaccine'], ['date', 'Date'], ['notes', 'Notes']]}
        make={(v) => ({ id: '', vaccine: v.vaccine || '', date: v.date || null, notes: v.notes || null })}
        label={(i) => i.vaccine} onSave={(x) => onSave({ immunizations: x })}
      />
      <SimpleList<Procedure>
        icon={<Stethoscope size={18} />} title="Procedures / surgeries" items={record.procedures}
        fields={[['name', 'Name'], ['date', 'Date'], ['notes', 'Notes']]}
        make={(v) => ({ id: '', name: v.name || '', date: v.date || null, notes: v.notes || null })}
        label={(i) => i.name} onSave={(x) => onSave({ procedures: x })}
      />
    </div>
  );
};

// Generic add/remove list with typed fields.
function SimpleList<T extends { id: string }>({ icon, title, items, fields, make, label, onSave }: {
  icon: React.ReactNode; title: string; items: T[];
  fields: [keyof T & string, string][];
  make: (draft: Record<string, string>) => T;
  label: (item: T) => string;
  onSave: (items: T[]) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const add = () => {
    const primary = fields[0][0];
    if (!draft[primary]) return;
    onSave([...items, make(draft)]);
    setDraft({});
  };
  return (
    <SectionCard icon={icon} title={title}>
      <div className="mb-3 flex flex-col gap-2">
        {fields.map(([k, ph]) => (
          <Input key={k} placeholder={ph} value={draft[k] || ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
        ))}
        <Button size="sm" variant="outline" onClick={add}><Plus size={14} /> Add</Button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={it.id || i} className="flex items-center justify-between rounded-[12px] bg-foreground/[0.04] px-3 py-2 text-[13.5px]">
            <span className="font-semibold">{label(it)}</span>
            <button onClick={() => onSave(items.filter((_, j) => j !== i))} className="text-destructive hover:text-foreground"><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length === 0 && <span className="text-[13px] italic text-muted-foreground/60">None recorded.</span>}
      </div>
    </SectionCard>
  );
}

const AllergyList: React.FC<{ items: Allergy[]; onSave: (a: Allergy[]) => void }> = ({ items, onSave }) => {
  const [d, setD] = useState({ substance: '', reaction: '', severity: '' });
  const sevColor: Record<string, string> = { mild: '#0E7569', moderate: '#D97706', severe: '#DC2626', 'life-threatening': '#991B1B' };
  return (
    <SectionCard icon={<AlertTriangle size={18} />} title="Allergies">
      <div className="mb-3 flex flex-col gap-2">
        <Input placeholder="Substance (e.g. Penicillin)" value={d.substance} onChange={(e) => setD({ ...d, substance: e.target.value })} />
        <Input placeholder="Reaction (e.g. rash)" value={d.reaction} onChange={(e) => setD({ ...d, reaction: e.target.value })} />
        <select value={d.severity} onChange={(e) => setD({ ...d, severity: e.target.value })}
          className="h-12 rounded-[14px] border border-input bg-background px-3 text-[14px]">
          <option value="">Severity…</option>
          <option value="mild">Mild</option><option value="moderate">Moderate</option>
          <option value="severe">Severe</option><option value="life-threatening">Life-threatening</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => { if (!d.substance) return; onSave([...items, { id: '', substance: d.substance, reaction: d.reaction || null, severity: (d.severity || null) as any }]); setD({ substance: '', reaction: '', severity: '' }); }}>
          <Plus size={14} /> Add allergy
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((a, i) => (
          <div key={a.id || i} className="flex items-center justify-between rounded-[12px] bg-foreground/[0.04] px-3 py-2 text-[13.5px]">
            <span className="flex items-center gap-2">
              {a.severity && <span className="h-2.5 w-2.5 rounded-full" style={{ background: sevColor[a.severity] }} />}
              <span className="font-semibold">{a.substance}</span>
              {a.reaction && <span className="text-muted-foreground">· {a.reaction}</span>}
            </span>
            <button onClick={() => onSave(items.filter((_, j) => j !== i))} className="text-destructive hover:text-foreground"><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length === 0 && <span className="text-[13px] italic text-muted-foreground/60">None recorded.</span>}
      </div>
    </SectionCard>
  );
};

const ConditionList: React.FC<{ items: Condition[]; onSave: (c: Condition[]) => void }> = ({ items, onSave }) => {
  const [d, setD] = useState({ name: '', status: 'active' });
  return (
    <SectionCard icon={<Activity size={18} />} title="Conditions">
      <div className="mb-3 flex flex-col gap-2">
        <Input placeholder="Condition (e.g. Asthma)" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}
          className="h-12 rounded-[14px] border border-input bg-background px-3 text-[14px]">
          <option value="active">Active</option><option value="chronic">Chronic</option><option value="resolved">Resolved</option>
        </select>
        <Button size="sm" variant="outline" onClick={() => { if (!d.name) return; onSave([...items, { id: '', name: d.name, status: d.status as any, diagnosedDate: null, notes: null }]); setD({ name: '', status: 'active' }); }}>
          <Plus size={14} /> Add condition
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((c, i) => (
          <div key={c.id || i} className="flex items-center justify-between rounded-[12px] bg-foreground/[0.04] px-3 py-2 text-[13.5px]">
            <span className="font-semibold">{c.name} <span className="ml-1 text-[11.5px] font-normal uppercase tracking-wide text-muted-foreground">{c.status}</span></span>
            <button onClick={() => onSave(items.filter((_, j) => j !== i))} className="text-destructive hover:text-foreground"><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length === 0 && <span className="text-[13px] italic text-muted-foreground/60">None recorded.</span>}
      </div>
    </SectionCard>
  );
};

const MedicationList: React.FC<{ items: Medication[]; onSave: (m: Medication[]) => void }> = ({ items, onSave }) => {
  const [d, setD] = useState({ name: '', dose: '', frequency: '' });
  return (
    <SectionCard icon={<Pill size={18} />} title="Medications">
      <div className="mb-3 flex flex-col gap-2">
        <Input placeholder="Name (e.g. Lisinopril)" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <div className="flex gap-2">
          <Input placeholder="Dose (10mg)" value={d.dose} onChange={(e) => setD({ ...d, dose: e.target.value })} />
          <Input placeholder="Frequency (daily)" value={d.frequency} onChange={(e) => setD({ ...d, frequency: e.target.value })} />
        </div>
        <Button size="sm" variant="outline" onClick={() => { if (!d.name) return; onSave([...items, { id: '', name: d.name, dose: d.dose || null, frequency: d.frequency || null, route: null, startDate: null, active: true }]); setD({ name: '', dose: '', frequency: '' }); }}>
          <Plus size={14} /> Add medication
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((m, i) => (
          <div key={m.id || i} className="flex items-center justify-between rounded-[12px] bg-foreground/[0.04] px-3 py-2 text-[13.5px]">
            <span className="font-semibold">{m.name}{m.dose && <span className="font-normal text-muted-foreground"> · {m.dose}</span>}{m.frequency && <span className="font-normal text-muted-foreground"> · {m.frequency}</span>}</span>
            <button onClick={() => onSave(items.filter((_, j) => j !== i))} className="text-destructive hover:text-foreground"><Trash2 size={14} /></button>
          </div>
        ))}
        {items.length === 0 && <span className="text-[13px] italic text-muted-foreground/60">None recorded.</span>}
      </div>
    </SectionCard>
  );
};

const EmergencyContacts: React.FC<{ contacts: EmergencyContact[]; onSave: (c: EmergencyContact[]) => void }> = ({ contacts, onSave }) => {
  const [d, setD] = useState({ name: '', relationship: '', phone: '' });
  return (
    <SectionCard icon={<Phone size={18} />} title="Emergency contacts">
      <div className="mb-3 flex flex-col gap-2">
        <Input placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <div className="flex gap-2">
          <Input placeholder="Relationship" value={d.relationship} onChange={(e) => setD({ ...d, relationship: e.target.value })} />
          <Input placeholder="Phone" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
        </div>
        <Button size="sm" variant="outline" onClick={() => { if (!d.name) return; onSave([...contacts, { id: '', name: d.name, relationship: d.relationship || null, phone: d.phone || null }]); setD({ name: '', relationship: '', phone: '' }); }}>
          <Plus size={14} /> Add contact
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {contacts.map((c, i) => (
          <div key={c.id || i} className="flex items-center justify-between rounded-[12px] bg-foreground/[0.04] px-3 py-2 text-[13.5px]">
            <span className="font-semibold">{c.name}{c.relationship && <span className="font-normal text-muted-foreground"> · {c.relationship}</span>}{c.phone && <span className="font-normal text-muted-foreground"> · {c.phone}</span>}</span>
            <button onClick={() => onSave(contacts.filter((_, j) => j !== i))} className="text-destructive hover:text-foreground"><Trash2 size={14} /></button>
          </div>
        ))}
        {contacts.length === 0 && <span className="text-[13px] italic text-muted-foreground/60">None recorded.</span>}
      </div>
    </SectionCard>
  );
};

// ---- Vitals tab ----
const VitalsTab: React.FC<{ vitals: Vital[]; onAdd: (t: VitalType, v: string, u: string) => void; onDelete: (id: string) => void }> = ({ vitals, onAdd, onDelete }) => {
  const [type, setType] = useState<VitalType>('bp');
  const [value, setValue] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-[clamp(18px,2.6vw,26px)]">
        <h3 className="mb-4 flex items-center gap-2 text-[15.5px] font-bold"><Activity size={18} className="text-teal-bright" /> Record a measurement</h3>
        <div className="flex flex-wrap items-end gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as VitalType)}
            className="h-12 rounded-[14px] border border-input bg-background px-3 text-[14px]">
            {Object.entries(VITAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <Input placeholder={`Value (${VITAL_LABELS[type].unit})`} value={value} onChange={(e) => setValue(e.target.value)} className="max-w-[200px]" />
          <Button size="sm" onClick={() => { if (!value) return; onAdd(type, value, VITAL_LABELS[type].unit); setValue(''); }}><Plus size={14} /> Add</Button>
        </div>
      </Card>
      <Card className="p-[clamp(18px,2.6vw,26px)]">
        <h3 className="mb-4 text-[15.5px] font-bold">History</h3>
        <div className="flex flex-col gap-2">
          {[...vitals].sort((a, b) => b.measuredAt - a.measuredAt).map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-[12px] bg-foreground/[0.04] px-3 py-2 text-[13.5px]">
              <span><span className="font-bold">{VITAL_LABELS[v.type]?.label || v.type}</span> · {v.value} {v.unit}</span>
              <span className="flex items-center gap-3 text-muted-foreground">
                <span className="text-[12px]">{fmtDate(v.measuredAt)}</span>
                <button onClick={() => onDelete(v.id)} className="text-destructive hover:text-foreground"><Trash2 size={14} /></button>
              </span>
            </div>
          ))}
          {vitals.length === 0 && <span className="text-[13px] italic text-muted-foreground/60">No measurements yet.</span>}
        </div>
      </Card>
    </div>
  );
};

// ---- Documents tab ----
const DocumentsTab: React.FC<{ docs: MedicalDocumentMeta[]; onUpload: (f: File, c: string) => void; onDownload: (d: MedicalDocumentMeta) => void; onDelete: (id: string) => void }> = ({ docs, onUpload, onDownload, onDelete }) => {
  const [category, setCategory] = useState('lab');
  return (
    <Card className="p-[clamp(18px,2.6vw,26px)]">
      <h3 className="mb-4 flex items-center gap-2 text-[15.5px] font-bold"><FileText size={18} className="text-teal-bright" /> Documents &amp; labs</h3>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="h-12 rounded-[14px] border border-input bg-background px-3 text-[14px]">
          <option value="lab">Lab result</option><option value="imaging">Imaging</option>
          <option value="note">Note</option><option value="other">Other</option>
        </select>
        <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[14px] bg-primary px-5 text-[13.5px] font-bold text-primary-foreground hover:bg-ink hover:text-ink-foreground">
          <Plus size={15} /> Upload
          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f, category); e.target.value = ''; }} />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        {docs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded-[12px] bg-foreground/[0.04] px-3 py-2 text-[13.5px]">
            <button onClick={() => onDownload(doc)} className="flex items-center gap-2 text-left hover:text-accent">
              <FileText size={15} className="text-muted-foreground" />
              <span className="font-semibold">{doc.filename}</span>
              <span className="text-[11.5px] uppercase tracking-wide text-muted-foreground">{doc.category}</span>
            </button>
            <span className="flex items-center gap-3 text-muted-foreground">
              <span className="text-[12px]">{fmtDate(doc.uploadedAt)}</span>
              <button onClick={() => onDelete(doc.id)} className="text-destructive hover:text-foreground"><Trash2 size={14} /></button>
            </span>
          </div>
        ))}
        {docs.length === 0 && <span className="text-[13px] italic text-muted-foreground/60">No documents uploaded.</span>}
      </div>
    </Card>
  );
};

// ---- Audit tab ----
const AuditTab: React.FC<{ entries: AuditEntry[] }> = ({ entries }) => (
  <Card className="p-[clamp(18px,2.6vw,26px)]">
    <h3 className="mb-1 flex items-center gap-2 text-[15.5px] font-bold"><History size={18} className="text-teal-bright" /> Access log</h3>
    <p className="mb-4 text-[12.5px] text-muted-foreground">Every time your record is read, changed, or exported is recorded here.</p>
    <div className="flex flex-col gap-1.5">
      {entries.map((e, i) => (
        <div key={i} className="flex items-center justify-between border-b border-foreground/[0.06] py-2 text-[13px] last:border-0">
          <span className="font-semibold capitalize">{e.action.replace('_', ' ')} <span className="font-normal text-muted-foreground">· {e.resource}</span></span>
          <span className="text-[12px] text-muted-foreground">{fmtDate(e.at)}{e.ip ? ` · ${e.ip}` : ''}</span>
        </div>
      ))}
      {entries.length === 0 && <span className="text-[13px] italic text-muted-foreground/60">No access recorded yet.</span>}
    </div>
  </Card>
);

export default EmrView;
