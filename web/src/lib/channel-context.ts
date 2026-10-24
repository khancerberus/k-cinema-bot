import { useOutletContext } from "react-router";
import type { ChannelProfile } from "../types/channel.type";

export interface ChannelContext {
  channel: ChannelProfile;
  setChannel: (channel: ChannelProfile) => void;
  // true si el visitante es el streamer del canal (sesión iniciada con ese canal)
  isOwner: boolean;
}

export const useChannel = () => useOutletContext<ChannelContext>();
