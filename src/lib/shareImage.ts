import type { Stats } from './stats';

export type ShareType = 'full' | 'streak' | 'milestone' | 'weekly';

export interface ShareMilestone {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

export interface ShareData {
  type: ShareType;
  stats?: Stats; // the whole stats object
  milestone?: ShareMilestone;
}

export async function generateShareImage(data: ShareData): Promise<void> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const stats = data.stats;
  if (!ctx || !stats) return;

  // Set high resolution for crispness
  const dpr = 2;
  const w = 1080;
  let h = 1080; // Default square for individual cards

  if (data.type === 'full') {
    h = 1920; // vertical format
  }

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  // Background (Dark Goldish/Slate)
  ctx.fillStyle = '#0f172a'; // slate-900 equivalent
  ctx.fillRect(0, 0, w, h);

  // Subtle gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1e293b'); // slate-800
  grad.addColorStop(1, '#020617'); // slate-950
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Decorative gold accents
  ctx.fillStyle = 'rgba(246, 227, 186, 0.05)';
  ctx.beginPath();
  ctx.arc(w, 0, w / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';

  if (data.type === 'streak') {
    ctx.font = 'bold 80px system-ui, sans-serif';
    ctx.fillStyle = '#f6e3ba'; // gold
    ctx.fillText('ðŸ”¥ Current Streak', w / 2, h / 2 - 80);
    
    ctx.font = 'bold 240px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${stats.currentStreak}`, w / 2, h / 2 + 80);
    
    ctx.font = 'bold 60px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Days on Valuable', w / 2, h / 2 + 180);

  } else if (data.type === 'milestone' && data.milestone) {
    const badgeEmoji = data.milestone.icon === 'flame' ? 'ðŸ”¥'
      : data.milestone.icon === 'hourglass' ? 'â³'
      : data.milestone.icon === 'check' ? 'âœ…'
      : data.milestone.icon === 'star' ? 'â­'
      : 'ðŸ†';
    ctx.font = '100px system-ui, sans-serif';
    ctx.fillText(badgeEmoji, w / 2, h / 2 - 120);

    ctx.font = 'bold 70px system-ui, sans-serif';
    ctx.fillStyle = '#f6e3ba';
    ctx.fillText('Just hit a milestone!', w / 2, h / 2);

    ctx.font = 'bold 100px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(data.milestone.title, w / 2, h / 2 + 140);

    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('on Valuable', w / 2, h / 2 + 230);
  } else if (data.type === 'weekly') {
    ctx.font = 'bold 80px system-ui, sans-serif';
    ctx.fillStyle = '#f6e3ba';
    ctx.fillText('This Week\'s Focus', w / 2, h / 2 - 100);

    const hours = Math.floor(stats.weekMinutes / 60);
    const mins = stats.weekMinutes % 60;
    
    ctx.font = 'bold 200px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${hours}h ${mins}m`, w / 2, h / 2 + 80);

    if (stats.lastWeekMinutes > 0) {
      const pct = Math.round(((stats.weekMinutes - stats.lastWeekMinutes) / stats.lastWeekMinutes) * 100);
      ctx.font = 'bold 60px system-ui, sans-serif';
      ctx.fillStyle = pct >= 0 ? '#4ade80' : '#f87171';
      ctx.fillText(`${pct >= 0 ? 'â†‘' : 'â†“'} ${Math.abs(pct)}% vs last week`, w / 2, h / 2 + 200);
    }
  } else if (data.type === 'full') {
    // Top banner
    ctx.textAlign = 'left';
    ctx.font = 'bold 100px system-ui, sans-serif';
    ctx.fillStyle = '#f6e3ba';
    ctx.fillText('My Focus Report', 100, 200);

    // Total hours
    const totalH = Math.floor(stats.totalMinutes / 60);
    ctx.font = 'bold 180px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${totalH}h`, 100, 450);
    ctx.font = 'bold 50px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Total Focused', 100, 520);

    // Streak
    ctx.font = 'bold 180px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${stats.currentStreak}d`, w / 2 + 50, 450);
    ctx.font = 'bold 50px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Current Streak', w / 2 + 50, 520);

    // Trend chart background
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(100, 700, w - 200, 400);

    // Trend chart line
    if (stats.last30Days && stats.last30Days.length > 0) {
      const maxM = Math.max(...stats.last30Days.map((d: { date: string; minutes: number }) => d.minutes), 1);
      ctx.beginPath();
      const chartW = w - 200;
      const chartH = 400;
      const startX = 100;
      const startY = 1100;
      
      stats.last30Days.forEach((d: { date: string; minutes: number }, i: number) => {
        const x = startX + (i / (stats.last30Days.length - 1)) * chartW;
        const y = startY - (d.minutes / maxM) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#f6e3ba';
      ctx.lineWidth = 8;
      ctx.stroke();

      // fill
      ctx.lineTo(startX + chartW, startY);
      ctx.lineTo(startX, startY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(246, 227, 186, 0.1)';
      ctx.fill();
    }

    // Top subjects
    ctx.textAlign = 'left';
    ctx.font = 'bold 70px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Top Subjects', 100, 1300);

    let sy = 1420;
    stats.subjects.slice(0, 4).forEach((subj: { name: string; minutes: number; percentage: number }) => {
      ctx.font = 'bold 50px system-ui, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(subj.name, 100, sy);
      
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f6e3ba';
      ctx.fillText(`${Math.round(subj.percentage)}%`, w - 100, sy);
      ctx.textAlign = 'left';

      // Bar
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(100, sy + 30, w - 200, 20);
      ctx.fillStyle = '#f6e3ba';
      ctx.fillRect(100, sy + 30, (w - 200) * (subj.percentage / 100), 20);

      sy += 120;
    });
  }

  // Branding watermark
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(246, 227, 186, 0.5)';
  ctx.fillText('VALUABLE', w / 2, h - 60);

  // Export and Share
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { resolve(); return; }
      
      const filename = `valuable-stats-${Date.now()}.png`;
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'My Focus Stats',
            files: [file]
          });
        } catch (e) {
          console.log('Share canceled or failed', e);
        }
      } else {
        // Fallback download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      resolve();
    }, 'image/png');
  });
}