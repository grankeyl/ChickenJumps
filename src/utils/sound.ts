export class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private soundtrack?: HTMLAudioElement;
  private isMuted = false;
  private soundtrackVolume = 0.2; // Тихая фоновая музыка
  private effectsVolume = 0.5; // Громкость эффектов

  constructor() {
    // Загружаем звуки
    this.loadSound('step', '/assets/sounds/step.webm');
    this.loadSound('cashout', '/assets/sounds/cashout.webm');
    this.loadSound('lose', '/assets/sounds/lose.webm');

    // Загружаем саундтрек отдельно
    this.soundtrack = new Audio('/assets/sounds/soundtrack.webm');
    this.soundtrack.loop = true;
    this.soundtrack.volume = this.soundtrackVolume;

    // Добавляем обработчик на случай если loop не сработает
    this.soundtrack.addEventListener('ended', () => {
      if (!this.isMuted && this.soundtrack) {
        this.soundtrack.currentTime = 0;
        this.soundtrack.play().catch(err => console.warn('Soundtrack restart failed:', err));
      }
    });
  }

  private loadSound(name: string, path: string) {
    const audio = new Audio(path);
    audio.volume = this.effectsVolume;
    this.sounds.set(name, audio);
  }

  play(name: string) {
    if (this.isMuted) return;

    const sound = this.sounds.get(name);
    if (sound) {
      // Создаем новый экземпляр для возможности одновременного воспроизведения
      const clone = sound.cloneNode() as HTMLAudioElement;
      clone.volume = this.effectsVolume;
      clone.play().catch(err => console.warn('Sound play failed:', err));
    }
  }

  startSoundtrack() {
    if (this.isMuted || !this.soundtrack) return;

    this.soundtrack.currentTime = 0;
    this.soundtrack.play().catch(err => console.warn('Soundtrack play failed:', err));
  }

  stopSoundtrack() {
    if (!this.soundtrack) return;
    this.soundtrack.pause();
    this.soundtrack.currentTime = 0;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.soundtrack) {
      if (muted) {
        this.soundtrack.pause();
      } else {
        this.soundtrack.play().catch(err => console.warn('Soundtrack play failed:', err));
      }
    }
  }

  setEffectsVolume(volume: number) {
    this.effectsVolume = Math.max(0, Math.min(1, volume));
  }

  setSoundtrackVolume(volume: number) {
    this.soundtrackVolume = Math.max(0, Math.min(1, volume));
    if (this.soundtrack) {
      this.soundtrack.volume = this.soundtrackVolume;
    }
  }
}
