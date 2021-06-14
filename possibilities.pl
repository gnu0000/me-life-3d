#!perl
#
# generate possible weights for a 3d life sim

use strict;
use warnings;

# weight drops off linearly with distance
#
#my $WEIGHT_SELF    = 0;     # self
#my $WEIGHT_FACE    = 1;     # neighboring cube sharing a face
#my $WEIGHT_EDGE    = 0.707; # neighboring cube sharing an edge
#my $WEIGHT_CORNER  = 0.414; # neighboring cube sharing a corner


# weight drops off as a square of distance
#
my $WEIGHT_SELF    = 0.0;       # self
my $WEIGHT_FACE    = 1.0;       # neighboring cube sharing a face
my $WEIGHT_EDGE    = 0.5;       # neighboring cube sharing an edge
my $WEIGHT_CORNER  = 0.333333;  # neighboring cube sharing a corner


my $weights = {};

for (my $faces=0; $faces<=6; $faces++)
   {
   for (my $edges=0; $edges<=12; $edges++)
      {
      for (my $corners=0; $corners<=8; $corners++)
         {
         my $weight = 
            $WEIGHT_SELF              +
            $faces   * $WEIGHT_FACE   +
            $edges   * $WEIGHT_EDGE   +
            $corners * $WEIGHT_CORNER ;

            $weight = (int($weight * 1000))/1000.0;

            $weights->{$weight} = 1;
         }
      }
   }

foreach my $key (sort {$a<=>$b} keys %{$weights})
   {
   print "$key\n";
   }

print "(" . scalar (keys %{$weights}) . " possible values)\n";