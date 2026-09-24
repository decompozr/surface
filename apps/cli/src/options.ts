export const cliOptions = {
  directory:{type:'string'},'allow-recipient-selection': { type: 'boolean' }, 'schema-file':{type:'string'},
  artifact:{type:'string'},source:{type:'string'},name:{type:'string'},project:{type:'string'},thread:{type:'string'},socket:{type:'string'},binding:{type:'string'},title:{type:'string'},request:{type:'string'},
  data:{type:'string'},'response-id':{type:'string'},port:{type:'string'},'state-dir':{type:'string'},
  bundle:{type:'string'},home:{type:'string'},repo:{type:'string'},ref:{type:'string'},release:{type:'string'},workspace:{type:'string'},'data-root':{type:'string'},
  namespace:{type:'string'},component:{type:'string'},help:{type:'boolean',short:'h'},
} as const;
