import { useState } from "react";
import { Outlet, useLoaderData } from "react-router";
import { NavBar } from "./NavBar";
import { getSession } from "../lib/session";
import type { ChannelContext } from "../lib/channel-context";
import type { ChannelProfile } from "../types/channel.type";

export const ChannelLayout = () => {
  const loadedChannel = useLoaderData<ChannelProfile>();
  // Perfil guardado desde el editor; se ignora si se navega a otro canal
  const [savedChannel, setSavedChannel] = useState<ChannelProfile | null>(null);
  const channel =
    savedChannel?.channelId === loadedChannel.channelId ? savedChannel : loadedChannel;

  const isOwner = getSession()?.channelId === channel.channelId;
  const context: ChannelContext = { channel, setChannel: setSavedChannel, isOwner };

  return (
    <>
      <NavBar channel={channel} isOwner={isOwner} />
      <Outlet context={context} />
    </>
  );
};
