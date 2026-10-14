export interface RobotConfig {
  id: string;
  name: string;
  email: string;
  avatar: string;
  bio: string;
  gender: 'male' | 'female';
  age?: number;
}

export const ROBOTS: RobotConfig[] = [];

class RobotSystem {
  init() {
    // Disabled - all robot users removed
  }

  public getAutoReply(_message: string, _robot: any) {
    return "";
  }
}

export const RobotManager = new RobotSystem();
