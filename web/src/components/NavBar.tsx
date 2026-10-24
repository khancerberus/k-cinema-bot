import { useNavigate } from "react-router";
import { clearSession, getSession } from "../lib/session";
import type { ChannelProfile } from "../types/channel.type";

interface NavBarProps {
  channel: ChannelProfile;
  isOwner: boolean;
}

export const NavBar = ({ channel, isOwner }: NavBarProps) => {
  const navigate = useNavigate();
  const session = getSession();
  const base = `/${channel.channelUsername}`;

  const logout = () => {
    clearSession();
    navigate("/");
  };

  return (
    <nav className="flex flex-wrap items-center min-h-14 px-4 py-2 gap-x-6 gap-y-2">
      <h1 className="text-2xl font-bold font-bebaskai">
        <a href={base}>K-Cinema Bot</a>
      </h1>

      <div className="flex flex-wrap gap-4">
        <a href="#" className="text-white hover:text-[#ffa300]">
          Recomendaciones
        </a>
        <a href={`${base}/rated-movies`} className="text-white hover:text-[#ffa300]">
          Rated Movies
        </a>
        {isOwner && (
          <a href={`${base}/current-movie`} className="text-white hover:text-[#ffa300]">
            Current Movie
          </a>
        )}
      </div>

      <div className="flex items-center gap-4 ml-auto text-sm">
        {session ? (
          <>
            {!isOwner && (
              <a href={`/${session.channelUsername}`} className="text-[#00fff9] hover:underline">
                Mi perfil
              </a>
            )}
            <button className="text-stone-400 hover:text-white cursor-pointer" onClick={logout}>
              Salir ({session.channelUsername})
            </button>
          </>
        ) : (
          <a href="/" className="text-[#00fff9] hover:underline">
            Entrar
          </a>
        )}
      </div>
    </nav>
  );
};
