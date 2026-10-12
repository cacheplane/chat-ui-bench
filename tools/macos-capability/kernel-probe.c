/* Compile and execute only on the prospective hosted VM, using its actual SDK. */
#include <libproc.h>
#include <sys/proc_info.h>
#include <sys/proc.h>
#include <unistd.h>
#include <stddef.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <CoreGraphics/CoreGraphics.h>
#include <CoreFoundation/CoreFoundation.h>

static void identity(pid_t pid,int detail) {
 struct proc_bsdinfo p={0}; errno=0;
 int bytes=proc_pidinfo(pid,PROC_PIDTBSDINFO,0,&p,sizeof(p));int error=errno;
 if(bytes!=(int)sizeof(p)||p.pbi_pid!=(unsigned)pid||p.pbi_start_tvsec==0||
    !(p.pbi_status==SIDL||p.pbi_status==SRUN||p.pbi_status==SSLEEP||p.pbi_status==SSTOP||p.pbi_status==SZOMB)) {
  printf("{\"status\":\"unknown\",\"pid\":%d,\"returnedBytes\":%d,\"errno\":%d}",pid,bytes,error);return;
 }
 errno=0;pid_t sid=getsid(pid);error=errno;
 if(sid<=0){printf("{\"status\":\"unknown\",\"pid\":%d,\"errno\":%d}",pid,error);return;}
 if(!detail) {
  printf("{\"status\":\"observed\",\"pid\":%u,\"ppid\":%u,\"pgid\":%u,\"sid\":%d,\"uid\":%u,\"birthSec\":%llu,\"birthUsec\":%llu,\"kernelStatus\":%u}",p.pbi_pid,p.pbi_ppid,p.pbi_pgid,sid,p.pbi_uid,(unsigned long long)p.pbi_start_tvsec,(unsigned long long)p.pbi_start_tvusec,p.pbi_status);return;
 }
 printf("{\"status\":\"observed\",\"pid\":%u,\"ppid\":%u,\"pgid\":%u,\"sid\":%d,\"uid\":%u,\"birthSec\":%llu,\"birthUsec\":%llu,\"kernelStatus\":%u,\"structBytes\":%zu,\"sdk\":{\"flavor\":%d,\"SSTOP\":%d,\"SZOMB\":%d,\"statusOffset\":%zu,\"pidOffset\":%zu,\"ppidOffset\":%zu,\"pgidOffset\":%zu,\"uidOffset\":%zu,\"birthSecOffset\":%zu,\"birthUsecOffset\":%zu}}",
 p.pbi_pid,p.pbi_ppid,p.pbi_pgid,sid,p.pbi_uid,(unsigned long long)p.pbi_start_tvsec,(unsigned long long)p.pbi_start_tvusec,p.pbi_status,sizeof(p),PROC_PIDTBSDINFO,SSTOP,SZOMB,
 offsetof(struct proc_bsdinfo,pbi_status),offsetof(struct proc_bsdinfo,pbi_pid),offsetof(struct proc_bsdinfo,pbi_ppid),offsetof(struct proc_bsdinfo,pbi_pgid),offsetof(struct proc_bsdinfo,pbi_uid),offsetof(struct proc_bsdinfo,pbi_start_tvsec),offsetof(struct proc_bsdinfo,pbi_start_tvusec));
}
static void group(pid_t pid) {
 int pids[257]={0};errno=0;
 int n=proc_listpids(PROC_PGRP_ONLY,(uint32_t)pid,pids,sizeof(pids));int error=errno;
 if(n<0||error!=0||n%(int)sizeof(int)||n>=(int)sizeof(pids)) {
  printf("{\"status\":\"unknown\",\"returnedBytes\":%d,\"errno\":%d,\"lookahead\":257,\"admittedMaximum\":256}",n,error);return;
 }
 printf("{\"status\":\"observed\",\"returnedBytes\":%d,\"lookahead\":257,\"admittedMaximum\":256,\"pidBytes\":%zu,\"members\":[",n,sizeof(int));
 for(int i=0;i<n/(int)sizeof(int);i++) {if(i)printf(",");if(pids[i]<=0){printf("{\"status\":\"unknown\",\"pid\":%d}",pids[i]);}else identity(pids[i],0);}
 printf("]}");
}
static int boolean(CFDictionaryRef dictionary,CFStringRef key) {
 const void *value=CFDictionaryGetValue(dictionary,key);
 return value&&CFGetTypeID(value)==CFBooleanGetTypeID()&&CFBooleanGetValue((CFBooleanRef)value);
}
static void display(void) {
 CFDictionaryRef session=CGSessionCopyCurrentDictionary();
 if(!session){printf("{\"status\":\"unknown\",\"reason\":\"No Quartz session\"}");return;}
 int onConsole=boolean(session,kCGSessionOnConsoleKey),loginDone=boolean(session,kCGSessionLoginDoneKey);
 CFRelease(session);
 uint32_t count=0,observed=0;CGDirectDisplayID ids[9]={0};
 CGError a=CGGetActiveDisplayList(0,NULL,&count),b=CGGetActiveDisplayList(9,ids,&observed);
 if(a!=kCGErrorSuccess||b!=kCGErrorSuccess||count==0||count>8||observed!=count) {
  printf("{\"status\":\"unknown\",\"countError\":%d,\"listError\":%d,\"displayCount\":%u,\"observedCount\":%u}",a,b,count,observed);return;
 }
 printf("{\"status\":\"observed\",\"onConsole\":%s,\"loginDone\":%s,\"main\":%u,\"displayCount\":%u,\"displays\":[",onConsole?"true":"false",loginDone?"true":"false",CGMainDisplayID(),count);
 for(uint32_t i=0;i<count;i++) {
  if(i)printf(",");CGRect r=CGDisplayBounds(ids[i]);
  if(!isfinite(r.origin.x)||!isfinite(r.origin.y)||!isfinite(r.size.width)||!isfinite(r.size.height)||r.size.width<=0||r.size.height<=0)printf("{\"status\":\"unknown\",\"id\":%u}",ids[i]);
  else printf("{\"id\":%u,\"x\":%.17g,\"y\":%.17g,\"width\":%.17g,\"height\":%.17g}",ids[i],r.origin.x,r.origin.y,r.size.width,r.size.height);
 }
 printf("]}");
}
int main(int argc,char **argv) {
 if(argc!=3)return 2;char *end;errno=0;long raw=strtol(argv[2],&end,10);
 if(errno||*end||raw<=0||raw>2147483647)return 2;
 printf("{\"helper\":");identity(getpid(),1);printf(",\"result\":");
 if(!strcmp(argv[1],"pid"))identity((pid_t)raw,1);
 else if(!strcmp(argv[1],"group"))group((pid_t)raw);
 else if(!strcmp(argv[1],"display"))display();else return 2;
 puts("}");return 0;
}
