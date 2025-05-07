import type { Chat } from '@/lib/db/schema';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
} from './icons';
import { memo } from 'react';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { cn } from '@/lib/utils';

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibility: chat.visibility,
  });

  return (
    <SidebarMenuItem className={cn(
      "overflow-hidden transition-all duration-200",
      isActive ? "bg-gradient-to-r from-galaxy-blue/10 to-galaxy-purple/5 border-l-2 border-galaxy-blue" : ""
    )}>
      <SidebarMenuButton 
        asChild 
        isActive={isActive}
        className={cn(
          "transition-all duration-200 hover:bg-galaxy-light rounded-md gap-2 py-2",
          isActive ? "bg-white/70 shadow-sm font-medium text-galaxy-blue" : ""
        )}
      >
        <Link href={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)}>
          <span className="truncate">{chat.title}</span>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className={cn(
              "data-[state=open]:bg-galaxy-light data-[state=open]:text-galaxy-blue mr-0.5 hover:bg-galaxy-light transition-colors duration-200",
              isActive ? "text-galaxy-blue" : ""
            )}
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="bottom" align="end" className="bg-white border border-galaxy-light shadow-galaxy-message rounded-lg animate-fade-in">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer hover:bg-galaxy-light hover:text-galaxy-blue">
              <ShareIcon />
              <span>Share</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-white border border-galaxy-light shadow-galaxy-message rounded-lg">
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between hover:bg-galaxy-light hover:text-galaxy-blue transition-colors duration-200"
                  onClick={() => {
                    setVisibilityType('private');
                  }}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <LockIcon size={12} />
                    <span>Private</span>
                  </div>
                  {visibilityType === 'private' && (
                    <div className="text-galaxy-green">
                      <CheckCircleFillIcon />
                    </div>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between hover:bg-galaxy-light hover:text-galaxy-blue transition-colors duration-200"
                  onClick={() => {
                    setVisibilityType('public');
                  }}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <GlobeIcon />
                    <span>Public</span>
                  </div>
                  {visibilityType === 'public' && (
                    <div className="text-galaxy-green">
                      <CheckCircleFillIcon />
                    </div>
                  )}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="cursor-pointer text-galaxy-red hover:bg-galaxy-red/10 hover:text-galaxy-red focus:bg-galaxy-red/15 focus:text-galaxy-red transition-colors duration-200"
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  return true;
});
