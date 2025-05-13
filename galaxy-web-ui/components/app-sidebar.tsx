'use client';

import type { User } from 'next-auth';
import { useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0 bg-gray-50">
      <SidebarHeader className="bg-gradient-to-r from-galaxy-navy via-galaxy-blue to-galaxy-purple text-white shadow-galaxy h-14">
        <SidebarMenu className="h-full">
          <div className="flex flex-row justify-between items-center h-full">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <span className="text-lg font-semibold px-2 hover:bg-white/10 rounded-md cursor-pointer transition-colors duration-200">
                Galaxy S25
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit text-white hover:bg-white/20 transition-all duration-200"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <div className="space-y-1 animate-fade-in">
          <SidebarHistory user={user} />
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-gray-200 bg-white/50">
        {user ? (
          <SidebarUserNav user={user} />
        ) : (
          <div className="p-3">
            <Link href="/login">
              <Button className="w-full bg-galaxy-blue hover:bg-galaxy-navy text-white">
                로그인
              </Button>
            </Link>
            <div className="text-center mt-2 text-xs text-gray-500">
              <span>계정이 없으신가요? </span>
              <Link href="/register" className="text-galaxy-blue hover:underline">
                회원가입
              </Link>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
