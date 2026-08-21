import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Elephant, ElephantType, Gender } from '../types/elephant';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Crown,
  Building2,
  RefreshCw,
  Info,
  Layers,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { Language } from '../utils/translations';

interface BulkImportElephantsProps {
  existingElephants: Elephant[];
  onSaveElephant: (elephant: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => Promise<void>;
  language: Language;
  onFinished: () => void;
}

interface ParsedElephantRow {
  id?: string;
  name: string;
  sinhalaName: string;
  otherNames: string[];
  gender: Gender;
  type: ElephantType;
  age: string | number;
  dateOfBirth: string;
  location: string;
  organization: string;
  mahout: string;
  tusks: string;
  physicalCharacteristics: string;
  description: string;
  peraheraParticipation: string[];
  photos: string[];
  status: 'living' | 'memorial';
  verified: boolean;
  isFeatured: boolean;
  isLive: boolean;
  customBadge: string;
  isValid: boolean;
  validationError?: string;
  isExistingMatch?: boolean;
  matchedId?: string;
}

const DEFAULT_SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1581852017103-68ac65514cf7?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80'
];

export const BulkImportElephants: React.FC<BulkImportElephantsProps> = ({
  existingElephants,
  onSaveElephant,
  language,
  onFinished,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedElephantRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [autoVerifyAll, setAutoVerifyAll] = useState(true);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [importComplete, setImportComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------
  // 1. GENERATE & DOWNLOAD TEMPLATES (Excel .xlsx & CSV .csv)
  // -------------------------------------------------------------
  const sampleTemplateData = [
    {
      'Elephant Name': 'Indiraja',
      'Sinhala Name': 'ඉන්දිරාජා',
      'Other Names': 'Indi Raja, Maligawa Indiraja',
      'Type (tusker/elephant)': 'tusker',
      'Gender (male/female)': 'male',
      'Age': 44,
      'Date of Birth': '1980',
      'Location': 'Kandy',
      'Organization / Temple': 'Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)',
      'Mahout': 'Kankanama Nilame / Royal Mahouts',
      'Tusks Details': 'දිගු සවිමත් යුගල දළ (Twin prominent tusks)',
      'Physical Characteristics': 'උස අඩි 9.5, පිරිපුන් ශරීර ලක්ෂණ, රාජකීය පෙනුම',
      'Description': 'ශ්‍රී දළදා මාළිගාවේ කරඬුව වඩමවන ප්‍රධාන රාජකීය හස්තිරාජයා.',
      'Perahera Participation': 'Kandy Esala Perahera, Bellanwila Perahera',
      'Photos (URLs comma separated)': 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1200&q=80',
      'Status (living/memorial)': 'living',
      'Verified (TRUE/FALSE)': 'TRUE',
      'Featured (TRUE/FALSE)': 'TRUE',
      'LIVE (TRUE/FALSE)': 'FALSE',
      'Custom Badge': 'Chief Casket Bearer',
    },
    {
      'Elephant Name': 'Myan Kumara',
      'Sinhala Name': 'මියන් කුමාර',
      'Other Names': 'Burma Kumara, Kumara',
      'Type (tusker/elephant)': 'tusker',
      'Gender (male/female)': 'male',
      'Age': 28,
      'Date of Birth': '1996',
      'Location': 'Bellanwila / Colombo',
      'Organization / Temple': 'Bellanwila Rajamaha Viharaya',
      'Mahout': 'Gamini Mahout',
      'Tusks Details': 'සවිමත් තේජාන්විත දළ යුගල',
      'Physical Characteristics': 'දේහ සම්පන්න තේජවන්ත පෙනුම, පුළුල් කුම්භස්තලය',
      'Description': 'බෙල්ලන්විල රජමහා විහාරයේ කරඬුව වැඩමවන ගෞරවනීය ඇත් රජු.',
      'Perahera Participation': 'Bellanwila Esala Perahera, Kandy Esala Perahera',
      'Photos (URLs comma separated)': 'https://images.unsplash.com/photo-1581852017103-68ac65514cf7?auto=format&fit=crop&w=1200&q=80',
      'Status (living/memorial)': 'living',
      'Verified (TRUE/FALSE)': 'TRUE',
      'Featured (TRUE/FALSE)': 'TRUE',
      'LIVE (TRUE/FALSE)': 'FALSE',
      'Custom Badge': 'Temple Tusker',
    },
    {
      'Elephant Name': 'Kandula',
      'Sinhala Name': 'කණ්ඩුල',
      'Other Names': 'Kandula Tusker',
      'Type (tusker/elephant)': 'tusker',
      'Gender (male/female)': 'male',
      'Age': 24,
      'Date of Birth': '2000',
      'Location': 'Kelaniya / Gampaha',
      'Organization / Temple': 'Kelaniya Raja Maha Viharaya',
      'Mahout': 'Sunil Keeper',
      'Tusks Details': 'සුදු පැහැති දිගු දළ යුගල',
      'Physical Characteristics': 'ගාම්භීර ගමන් විලාශය සහ පැහැදිලි කන් රටා',
      'Description': 'කැලණිය දුරුතු මහා පෙරහැරේ ප්‍රධාන තැන් දරන ඇත් රජු.',
      'Perahera Participation': 'Kelaniya Duruthu Perahera',
      'Photos (URLs comma separated)': 'https://images.unsplash.com/photo-1549366021-9f761d450615?auto=format&fit=crop&w=1200&q=80',
      'Status (living/memorial)': 'living',
      'Verified (TRUE/FALSE)': 'TRUE',
      'Featured (TRUE/FALSE)': 'FALSE',
      'LIVE (TRUE/FALSE)': 'FALSE',
      'Custom Badge': 'Duruthu Perahera Tusker',
    }
  ];

  const handleDownloadExcelTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(sampleTemplateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Elephants_Template');
    XLSX.writeFile(wb, 'alimedia_elephants_bulk_template.xlsx');
  };

  const handleDownloadCSVTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(sampleTemplateData);
    const csvOutput = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alimedia_elephants_bulk_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------
  // 2. PARSE EXCEL / CSV FILE
  // -------------------------------------------------------------
  const normalizeKey = (key: string): string => {
    return key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const processWorkbook = (wb: XLSX.WorkBook) => {
    try {
      const firstSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[firstSheetName];
      const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rawData || rawData.length === 0) {
        alert(language === 'si' ? 'ගොනුවේ දත්ත පේළි කිසිවක් හමු නොවීය.' : 'No data rows found in the file.');
        return;
      }

      const rows: ParsedElephantRow[] = rawData.map((rawRow, idx) => {
        // Map raw headers flexibly
        const mapped: Record<string, any> = {};
        Object.entries(rawRow).forEach(([key, val]) => {
          const norm = normalizeKey(key);
          if (norm.includes('sinhala') || norm.includes('sinhala') || norm.includes('sinh')) {
            mapped.sinhalaName = String(val).trim();
          } else if (norm.includes('name') || norm.includes('title')) {
            if (!mapped.name) mapped.name = String(val).trim();
          } else if (norm.includes('other') || norm.includes('alias')) {
            mapped.otherNames = String(val);
          } else if (norm.includes('type')) {
            mapped.type = String(val).toLowerCase();
          } else if (norm.includes('gender') || norm.includes('sex')) {
            mapped.gender = String(val).toLowerCase();
          } else if (norm.includes('age')) {
            mapped.age = val;
          } else if (norm.includes('birth') || norm.includes('dob')) {
            mapped.dateOfBirth = String(val);
          } else if (norm.includes('location') || norm.includes('city')) {
            mapped.location = String(val);
          } else if (norm.includes('org') || norm.includes('temple') || norm.includes('owner')) {
            mapped.organization = String(val);
          } else if (norm.includes('mahout') || norm.includes('keeper')) {
            mapped.mahout = String(val);
          } else if (norm.includes('tusk')) {
            mapped.tusks = String(val);
          } else if (norm.includes('physic') || norm.includes('charac') || norm.includes('feature')) {
            mapped.physicalCharacteristics = String(val);
          } else if (norm.includes('desc') || norm.includes('detail')) {
            mapped.description = String(val);
          } else if (norm.includes('perah') || norm.includes('fest')) {
            mapped.peraheraParticipation = String(val);
          } else if (norm.includes('photo') || norm.includes('image') || norm.includes('url')) {
            mapped.photos = String(val);
          } else if (norm.includes('status')) {
            mapped.status = String(val).toLowerCase();
          } else if (norm.includes('verif')) {
            mapped.verified = String(val).toLowerCase();
          } else if (norm.includes('feat')) {
            mapped.isFeatured = String(val).toLowerCase();
          } else if (norm.includes('live')) {
            mapped.isLive = String(val).toLowerCase();
          } else if (norm.includes('badge')) {
            mapped.customBadge = String(val);
          }
        });

        // Resolve Primary Name
        const name = mapped.name || (typeof rawRow['Name'] === 'string' ? rawRow['Name'] : '') || `Elephant_${idx + 1}`;
        const sinhalaName = mapped.sinhalaName || (typeof rawRow['Sinhala Name'] === 'string' ? rawRow['Sinhala Name'] : '');
        
        // Resolve Type
        let elephantType: ElephantType = 'tusker';
        const typeStr = (mapped.type || '').toLowerCase();
        if (typeStr.includes('ali') || typeStr.includes('elep') || typeStr === 'elephant') {
          elephantType = 'elephant';
        }

        // Resolve Gender
        let gender: Gender = 'male';
        const genderStr = (mapped.gender || '').toLowerCase();
        if (genderStr.includes('fem') || genderStr.includes('gah') || genderStr === 'female') {
          gender = 'female';
        }

        // Parse Other names
        const otherNames = (mapped.otherNames || '')
          .split(/[,;\n|]/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        // Parse Peraheras
        const peraheras = (mapped.peraheraParticipation || '')
          .split(/[,;\n|]/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        // Parse Photos
        const parsedPhotos = (mapped.photos || '')
          .split(/[,;\n|]/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.startsWith('http') || s.startsWith('data:image'));
        
        if (parsedPhotos.length === 0) {
          parsedPhotos.push(DEFAULT_SAMPLE_PHOTOS[idx % DEFAULT_SAMPLE_PHOTOS.length]);
        }

        // Check if existing elephant match
        const existingMatch = existingElephants.find((e) =>
          e.name.trim().toLowerCase() === name.trim().toLowerCase() ||
          (sinhalaName && e.sinhalaName && e.sinhalaName.trim() === sinhalaName.trim())
        );

        // Validation
        const isValid = name.trim().length > 0;
        const validationError = !isValid ? 'Elephant name missing' : undefined;

        return {
          name,
          sinhalaName,
          otherNames,
          gender,
          type: elephantType,
          age: mapped.age || (mapped.dateOfBirth ? `${new Date().getFullYear() - parseInt(mapped.dateOfBirth) || ''}` : ''),
          dateOfBirth: String(mapped.dateOfBirth || ''),
          location: mapped.location || 'Sri Lanka',
          organization: mapped.organization || 'Sri Lanka',
          mahout: mapped.mahout || 'National Custodians',
          tusks: mapped.tusks || (elephantType === 'tusker' ? 'දිගු සවිමත් යුගල දළ (Twin Tusks)' : 'N/A'),
          physicalCharacteristics: mapped.physicalCharacteristics || '',
          description: mapped.description || (sinhalaName ? `${sinhalaName} - ශ්‍රී ලාංකේය හීලෑ ඇත් රජෙකි.` : `${name} - Sri Lankan domesticated elephant.`),
          peraheraParticipation: peraheras,
          photos: parsedPhotos,
          status: mapped.status === 'memorial' ? 'memorial' : 'living',
          verified: mapped.verified === 'false' || mapped.verified === '0' ? false : true,
          isFeatured: mapped.isFeatured === 'true' || mapped.isFeatured === '1' || mapped.isFeatured === 'yes',
          isLive: mapped.isLive === 'true' || mapped.isLive === '1' || mapped.isLive === 'yes',
          customBadge: mapped.customBadge || '',
          isValid,
          validationError,
          isExistingMatch: Boolean(existingMatch),
          matchedId: existingMatch?.id,
        };
      });

      setParsedRows(rows);
    } catch (err: any) {
      alert(`Error reading file: ${err.message || err}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setIsParsing(true);
    setImportComplete(false);
    setImportLogs([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result;
      if (buffer) {
        const wb = XLSX.read(buffer, { type: 'binary' });
        processWorkbook(wb);
      }
    };
    reader.readAsBinaryString(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      setFile(dropped);
      setIsParsing(true);
      setImportComplete(false);
      setImportLogs([]);

      const reader = new FileReader();
      reader.onload = (evt) => {
        const buffer = evt.target?.result;
        if (buffer) {
          const wb = XLSX.read(buffer, { type: 'binary' });
          processWorkbook(wb);
        }
      };
      reader.readAsBinaryString(dropped);
    }
  };

  // Remove row from preview
  const handleRemoveRow = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
  };

  // -------------------------------------------------------------
  // 3. EXECUTE BULK IMPORT INTO FIRESTORE
  // -------------------------------------------------------------
  const handleStartImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      alert(language === 'si' ? 'ඇතුළත් කිරීමට වලංගු වාර්තා නොමැත.' : 'No valid records to import.');
      return;
    }

    setIsImporting(true);
    setImportComplete(false);
    const total = validRows.length;
    let successCount = 0;
    let failCount = 0;
    const logs: string[] = [];

    setImportProgress({ current: 0, total, success: 0, failed: 0 });

    for (let i = 0; i < total; i++) {
      const row = validRows[i];
      setImportProgress({ current: i + 1, total, success: successCount, failed: failCount });

      try {
        const payload: Omit<Elephant, 'id' | 'createdAt' | 'updatedAt'> = {
          name: row.name,
          sinhalaName: row.sinhalaName,
          otherNames: row.otherNames,
          gender: row.gender,
          type: row.type,
          age: row.age,
          dateOfBirth: row.dateOfBirth,
          location: row.location,
          organization: row.organization,
          mahout: row.mahout,
          tusks: row.tusks,
          physicalCharacteristics: row.physicalCharacteristics,
          description: row.description,
          peraheraParticipation: row.peraheraParticipation,
          photos: row.photos,
          sources: [
            {
              title: 'Official Custodians / Bulk Import Registry',
              publisher: 'Sri Lankan Elephant Registry',
              verifiedDate: new Date().getFullYear().toString(),
            }
          ],
          verified: autoVerifyAll ? true : row.verified,
          status: row.status,
          isFeatured: row.isFeatured,
          isLive: row.isLive,
          customBadge: row.customBadge,
        };

        const targetId = updateExisting && row.isExistingMatch ? row.matchedId : undefined;
        await onSaveElephant(payload, targetId);

        successCount++;
        logs.push(`✓ [${i + 1}/${total}] ${row.name} (${row.sinhalaName || 'Elephant'}) - ${targetId ? 'යාවත්කාලීන විය (Updated)' : 'එක් විය (Added)'}`);
      } catch (err: any) {
        failCount++;
        logs.push(`✗ [${i + 1}/${total}] ${row.name} - Error: ${err.message || err}`);
      }

      setImportLogs([...logs]);
    }

    setImportProgress({ current: total, total, success: successCount, failed: failCount });
    setIsImporting(false);
    setImportComplete(true);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const matchCount = parsedRows.filter((r) => r.isExistingMatch).length;

  return (
    <div className="space-y-6 animate-fadeIn text-[#062E22]">
      {/* Top Banner with Template Downloads */}
      <div className="bg-gradient-to-r from-[#062E22] to-emerald-900 text-white rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-zinc-950 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>BULK IMPORT WIZARD</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {language === 'si'
              ? 'Excel / CSV හරහා එකවර අලි ඇතුන් රාශියක් ඇතුළත් කරන්න'
              : 'Bulk Import Multiple Elephants via Excel or CSV'}
          </h2>

          <p className="text-xs text-emerald-100/90 leading-relaxed">
            {language === 'si'
              ? 'විහාරස්ථාන හෝ සංරක්ෂණ ලේඛනාගාරයේ ඇති අලි ඇතුන්ගේ තොරතුරු Excel (.xlsx) හෝ CSV ගොනුවක් මඟින් එක ක්ලික් එකකින් වෙබ් අඩවියට ලියාපදිංචි කරගත හැක.'
              : 'Upload multiple elephant records at once using a structured Excel spreadsheet or CSV file. Automatically detects existing elephants to update or add new ones.'}
          </p>

          {/* Download Sample Templates Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              onClick={handleDownloadExcelTemplate}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Excel Template (.xlsx)</span>
            </button>

            <button
              onClick={handleDownloadCSVTemplate}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-2 backdrop-blur-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV Template (.csv)</span>
            </button>
          </div>
        </div>

        {/* Decorative Background Icon */}
        <FileSpreadsheet className="absolute -right-6 -bottom-6 w-48 h-48 text-white/5 pointer-events-none" />
      </div>

      {/* File Upload / Drag & Drop Area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="bg-white rounded-3xl p-8 border-2 border-dashed border-emerald-300 hover:border-emerald-600 transition-all cursor-pointer text-center space-y-3 shadow-xs group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-16 h-16 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto transition-transform group-hover:scale-110 shadow-xs">
          <Upload className="w-8 h-8" />
        </div>

        <div>
          <h3 className="font-extrabold text-sm sm:text-base text-[#062E22]">
            {file ? file.name : (language === 'si' ? 'Excel (.xlsx) හෝ CSV (.csv) ගොනුව මෙතැනට Drag කරන්න' : 'Drag & drop Excel or CSV file here')}
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {file ? `${(file.size / 1024).toFixed(1)} KB` : (language === 'si' ? 'හෝ පරිගණකයෙන් තෝරා ගැනීමට ක්ලික් කරන්න' : 'or click to browse from computer')}
          </p>
        </div>

        {isParsing && (
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-800 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>ගොනුව කියවමින් පවතී (Parsing spreadsheet data)...</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PARSED DATA PREVIEW & CONTROLS                                */}
      {/* ------------------------------------------------------------- */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-zinc-200 shadow-sm space-y-4">
          {/* Summary & Options Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-[#062E22] flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>
                  {language === 'si' ? `හඳුනාගත් අලි පැතිකඩ (${parsedRows.length})` : `Parsed Elephant Profiles (${parsedRows.length})`}
                </span>
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                {validCount} Valid • {matchCount} Existing Matches (Ready to update)
              </p>
            </div>

            {/* Import Options Checkboxes */}
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
              <label className="flex items-center gap-1.5 cursor-pointer bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-200">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-700"
                />
                <span>නම ගැලපෙන විට යාවත්කාලීන කරන්න (Update Matches)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-200">
                <input
                  type="checkbox"
                  checked={autoVerifyAll}
                  onChange={(e) => setAutoVerifyAll(e.target.checked)}
                  className="rounded text-emerald-700 focus:ring-emerald-700"
                />
                <span>Auto-Verify all (සත්‍යාපිත ලාංඡනය ලබාදෙන්න)</span>
              </label>
            </div>
          </div>

          {/* Table Preview */}
          <div className="overflow-x-auto max-h-[380px] rounded-2xl border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F5] border-b border-zinc-200 text-zinc-500 font-extrabold uppercase tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Elephant Details</th>
                  <th className="py-2.5 px-3">Type & Gender</th>
                  <th className="py-2.5 px-3">Organization / Location</th>
                  <th className="py-2.5 px-3">Mahout & Tusks</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-zinc-400">{idx + 1}</td>
                    
                    {/* Name + Sinhala Name + Photo */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0">
                          <img
                            src={row.photos[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 max-w-[160px]">
                          <div className="font-extrabold text-[#062E22] truncate">
                            {row.name}
                          </div>
                          {row.sinhalaName && (
                            <div className="text-[10px] text-emerald-800 font-sinhala truncate">
                              {row.sinhalaName}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Type & Gender */}
                    <td className="py-2.5 px-3">
                      <div className="space-y-0.5">
                        <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          row.type === 'tusker' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                        }`}>
                          {row.type === 'tusker' ? 'Tusker (ඇතා)' : 'Elephant (අලියා)'}
                        </span>
                        <div className="text-[10px] text-zinc-400 capitalize">{row.gender}</div>
                      </div>
                    </td>

                    {/* Organization & Location */}
                    <td className="py-2.5 px-3">
                      <div className="text-zinc-700 font-semibold truncate max-w-[160px]">
                        {row.organization || 'Sri Lanka'}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">{row.location}</div>
                    </td>

                    {/* Mahout & Tusks */}
                    <td className="py-2.5 px-3">
                      <div className="text-zinc-700 truncate max-w-[140px]">{row.mahout}</div>
                      <div className="text-[10px] text-zinc-400 truncate max-w-[140px]">{row.tusks}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 text-center">
                      {row.isExistingMatch ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Will Update</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>New Record</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Progress Bar during import */}
          {importProgress && (
            <div className="space-y-2 pt-2 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#062E22]">
                  {importComplete ? 'Import Completed!' : 'Importing records to database...'}
                </span>
                <span className="text-emerald-800">
                  {importProgress.current} / {importProgress.total} ({importProgress.success} Success, {importProgress.failed} Failed)
                </span>
              </div>

              <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-600 to-amber-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                />
              </div>

              {/* Logs */}
              {importLogs.length > 0 && (
                <div className="max-h-28 overflow-y-auto bg-white p-2.5 rounded-xl border border-zinc-200 text-[11px] font-mono space-y-0.5">
                  {importLogs.map((log, lIdx) => (
                    <div key={lIdx} className={log.startsWith('✓') ? 'text-emerald-700' : 'text-red-600'}>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              onClick={() => {
                setParsedRows([]);
                setFile(null);
                setImportProgress(null);
              }}
              className="px-4 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {language === 'si' ? 'සියල්ල ඉවත් කරන්න (Clear)' : 'Clear Table'}
            </button>

            <div className="flex items-center gap-2">
              {importComplete ? (
                <button
                  onClick={onFinished}
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-md flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{language === 'si' ? 'අවසන් කරන්න (Done / View Directory)' : 'Finish & View Directory'}</span>
                </button>
              ) : (
                <button
                  onClick={handleStartImport}
                  disabled={isImporting || validCount === 0}
                  className="px-7 py-3 bg-[#062E22] hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>ඇතුළත් වෙමින් පවතී ({importProgress?.current || 0}/{validCount})...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>
                        {language === 'si'
                          ? `අලි ${validCount} දෙනාම එකවර එක් කරන්න (Import All)`
                          : `Import All ${validCount} Elephants Now`}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
